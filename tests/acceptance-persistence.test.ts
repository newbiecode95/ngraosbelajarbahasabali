import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// All AI entry points are mocked. This suite exercises real PostgreSQL commits,
// locks and HTTP ownership checks without making provider requests or spending API credit.
vi.mock('../src/server/openrouter',()=>({
  embed:vi.fn(async()=>{throw new Error('Deterministic lexical fallback in acceptance test');}),
  roleplay:vi.fn(async(input:{text:string;lesson:{objectives:{id:string;evidence:string[]}[]}})=>({
    reply:'Suksma.',translation:{id:'Terima kasih.',en:'Thank you.'},corrections:[],
    objectiveEvidence:input.lesson.objectives.filter(o=>o.evidence.some(e=>input.text.toLowerCase().includes(e))).map(o=>({objectiveId:o.id,quote:input.text})),
  })),
  generateQuiz:vi.fn(async()=>({questions:[
    {type:'choice',prompt:{id:'Pilih ungkapan terima kasih.',en:'Choose the expression of thanks.'},options:['Suksma.','Tiang pamit.','Aji kuda niki?','Wastan titiang Ayu.'],answer:'Suksma.',sourceId:'phrase:warung-07',mistakeId:null},
    {type:'order',prompt:{id:'Susun sapaan pagi.',en:'Arrange the morning greeting.'},options:[],answer:'Rahajeng semeng.',sourceId:'phrase:warung-01',mistakeId:null},
    {type:'repeat',prompt:{id:'Dengarkan lalu ulangi.',en:'Listen and repeat.'},options:[],answer:'Tiang pamit.',sourceId:'phrase:warung-13',mistakeId:null},
    {type:'choice',prompt:{id:'Pilih ungkapan pamit.',en:'Choose the expression for taking leave.'},options:['Tiang pamit.','Suksma.','Aji kuda niki?','Wastan titiang Ayu.'],answer:'Tiang pamit.',sourceId:'phrase:warung-13',mistakeId:null},
    {type:'repeat',prompt:{id:'Dengarkan lalu ulangi.',en:'Listen and repeat.'},options:[],answer:'Suksma.',sourceId:'phrase:warung-07',mistakeId:null},
  ]})),
  transcribe:vi.fn(),synthesize:vi.fn(),modelCatalog:vi.fn(),recordUsage:vi.fn(),
}));
import { query, getPool } from '../src/server/db';
import { hashToken, type ActorRow } from '../src/server/actors';
import { addTurn, completeSession, ownedSession, prepareQuiz, startSession, useHint } from '../src/server/game';
import { dispatch } from '../src/server/api';
import { origin } from '../src/server/config';
import { AppError } from '../src/server/errors';
import { roleplay, generateQuiz } from '../src/server/openrouter';

const enabled=process.env.RUN_DB_TESTS==='1';

describe.skipIf(!enabled)('20-player concurrent persistence acceptance (real DB, mocked AI)',()=>{
  let actors:ActorRow[]=[];
  const tokens=Array.from({length:20},()=>randomBytes(32).toString('hex'));
  const ids=Array.from({length:20},()=>randomUUID());
  let sessionIds:string[]=[];
  let observer:Pool;
  beforeAll(async()=>{
    const fixtures=ids.map((id,i)=>({id,name:`Acceptance ${i}`,hash:hashToken(tokens[i])}));
    await query(`INSERT INTO players(id,name,demo_token_hash,expires_at)
      SELECT x.id,x.name,x.hash,now()+interval '1 day' FROM jsonb_to_recordset($1::jsonb) AS x(id text,name text,hash text)`,[JSON.stringify(fixtures)]);
    const rows=(await query<ActorRow>('SELECT * FROM players WHERE id=ANY($1::text[])',[ids])).rows;
    actors=ids.map(id=>rows.find(row=>row.id===id)!);
    // Independent pool confirms committed persistence, rather than transaction-local state.
    observer=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000});
    const sources=await query('SELECT id FROM corpus_entries WHERE id=ANY($1::text[]) AND enabled=true', [['phrase:warung-01','phrase:warung-07','phrase:warung-13']]);
    expect(sources.rows).toHaveLength(3);
  },30_000);
  afterAll(async()=>{
    if(actors.length) {
      await query('DELETE FROM players WHERE id=ANY($1::text[])',[ids]);
      const rateKeys=ids.flatMap(id=>['start','hint','quiz','turn'].map(prefix=>`${prefix}:${id}`));
      await query('DELETE FROM rate_limits WHERE key=ANY($1::text[])',[rateKeys]);
    }
    await observer?.end();
    await getPool().end();
  });

  it('commits 20 independent active sessions and serializes concurrent starts for one account',async()=>{
    const sessions=await Promise.all(actors.map(actor=>startSession(actor,'warung')));
    sessionIds=sessions.map(s=>s.id);
    expect(new Set(sessionIds).size).toBe(20);
    const repeated=await Promise.all(Array.from({length:20},()=>startSession(actors[0],'warung')));
    expect(new Set(repeated.map(s=>s.id))).toEqual(new Set([sessionIds[0]]));
    const persisted=await observer.query('SELECT id,player_id FROM game_sessions WHERE player_id=ANY($1::text[])',[ids]);
    expect(persisted.rows).toHaveLength(20);
    for(let i=0;i<ids.length;i++) expect(persisted.rows.find(s=>s.id===sessionIds[i])?.player_id).toBe(ids[i]);
  },60_000);

  it('persists hints and all 60 distinct mock-assisted turns without losing progress',async()=>{
    await Promise.all(actors.slice(0,10).map((actor,i)=>useHint(actor,sessionIds[i])));
    for(const text of ['Rahajeng semeng.','Suksma.','Tiang pamit.']) {
      await Promise.all(actors.map((actor,i)=>addTurn(actor,sessionIds[i],{id:randomUUID(),text})));
    }
    const rows=(await observer.query('SELECT turns,completed_objectives,hints_used,player_id FROM game_sessions WHERE player_id=ANY($1::text[])',[ids])).rows;
    for(const row of rows) {
      expect(row.turns).toHaveLength(3);
      expect(row.completed_objectives).toHaveLength(3);
      expect(new Set(row.turns.map((t:{id:string})=>t.id)).size).toBe(3);
      expect(row.hints_used).toBe(ids.indexOf(row.player_id)<10?1:0);
    }
    expect(roleplay).toHaveBeenCalledTimes(60);
  },60_000);

  it('creates reinforcement quizzes without inventing errors and awards hint-capped stars durably',async()=>{
    const quizzes=await Promise.all(actors.map((actor,i)=>prepareQuiz(actor,sessionIds[i])));
    for(const session of quizzes) {
      expect(session.quiz).toHaveLength(5);
      expect(new Set(session.quiz!.map(q=>q.type)).size).toBe(3);
      for(const q of session.quiz!) {expect(q.reinforcement).toBe(true);expect(q.mistakeId).toBeUndefined();expect(q).not.toHaveProperty('answer');}
    }
    for(const call of vi.mocked(generateQuiz).mock.calls) expect(call[0].mistakes).toEqual([]);
    const privateRows=await Promise.all(actors.map((actor,i)=>ownedSession(sessionIds[i],actor.id)));
    const results=await Promise.all(actors.map((actor,i)=>completeSession(actor,sessionIds[i],Object.fromEntries(privateRows[i].quiz!.map(q=>[q.id,q.answer])))));
    for(let i=0;i<results.length;i++) {
      expect(results[i].result.stars).toBe(i<10?2:3);
      expect(results[i].result.quizScore).toBe(5);
      expect(results[i].result.xp).toBe(180);
      expect(results[i].result.newAlbum).toBe(true);
      expect(results[i].result.unlockedLevel).toBe('kos');
    }
    const persisted=await observer.query('SELECT p.id,p.xp,p.stars,p.albums,s.status FROM players p JOIN game_sessions s ON p.id=s.player_id WHERE p.id=ANY($1::text[])',[ids]);
    expect(persisted.rows).toHaveLength(20);
    for(const row of persisted.rows) {expect(row.xp).toBe(180);expect(row.status).toBe('completed');expect(row.albums).toEqual(['warung']);}
    const rewards=await observer.query('SELECT count(*)::int AS count FROM reward_events WHERE player_id=ANY($1::text[])',[ids]);
    expect(rewards.rows[0].count).toBe(20);
    const mistakes=await observer.query('SELECT count(*)::int AS count FROM mistakes WHERE player_id=ANY($1::text[])',[ids]);
    expect(mistakes.rows[0].count).toBe(0);
  },60_000);

  it('isolates persisted sessions at the HTTP boundary across 20 different identity cookies',async()=>{
    for(let i=0;i<actors.length;i++) {
      const headers={Cookie:`ngraos_demo=${tokens[i]}`,Origin:origin(),'Content-Type':'application/json'};
      const own=await dispatch(new Request(`${origin()}/api/sessions/${sessionIds[i]}`,{headers}));
      expect(own.status).toBe(200);
      expect((await own.json()).session.id).toBe(sessionIds[i]);
      const foreign=sessionIds[(i+1)%sessionIds.length];
      const read=await dispatch(new Request(`${origin()}/api/sessions/${foreign}`,{headers}));
      expect(read.status).toBe(404);
      const mutate=await dispatch(new Request(`${origin()}/api/sessions/${foreign}/complete`,{method:'POST',headers,body:JSON.stringify({answers:{}})}));
      expect(mutate.status).toBe(404);
    }
  },60_000);

  it('rolls back a provider failure and allows a successful retry of the same turn ID',async()=>{
    const session=await startSession(actors[0],'warung');
    const input={id:randomUUID(),text:'Rahajeng semeng.'};
    vi.mocked(roleplay).mockRejectedValueOnce(new AppError(504,'AI_TIMEOUT','Fixture provider timeout',true));
    await expect(addTurn(actors[0],session.id,input)).rejects.toMatchObject({code:'AI_TIMEOUT'});
    const failed=(await observer.query('SELECT turns,completed_objectives FROM game_sessions WHERE id=$1',[session.id])).rows[0];
    expect(failed.turns).toEqual([]);expect(failed.completed_objectives).toEqual([]);
    const retried=await addTurn(actors[0],session.id,input);
    expect(retried.session.turns).toHaveLength(1);
    expect(retried.turn.id).toBe(input.id);
  },30_000);
});
