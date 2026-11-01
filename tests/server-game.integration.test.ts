import 'dotenv/config';
import { afterAll,beforeAll,describe,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('../src/server/openrouter',async importOriginal=>{
  const actual=await importOriginal<typeof import('../src/server/openrouter')>();
  return {...actual,embed:vi.fn(async()=>{throw new Error('embedding unavailable');}),roleplay:vi.fn(async(input:Parameters<typeof actual.roleplay>[0])=>{
    await actual.recordUsage({playerId:input.playerId,stage:'integration_fixture',db:input.db},'fixture',Date.now());
    return {reply:'Rahajeng rauh.',translation:{id:'Selamat datang.',en:'Welcome.'},objectiveEvidence:[{objectiveId:'warung:greet',quote:'Rahajeng semeng'}],corrections:[]};
  }),generateQuiz:vi.fn(),repairReply:vi.fn()};
});
import { query,getPool,transaction } from '../src/server/db';
import { addTurn,checkQuizAnswer,completeSession,loadSession,ownedSession,repairTurnReply,sessionView,startSession,useHint } from '../src/server/game';
import { roleplay,recordUsage,repairReply } from '../src/server/openrouter';
import type { ActorRow } from '../src/server/actors';
import { lessonById } from '../src/server/content';
const enabled=process.env.RUN_DB_TESTS==='1';
describe.skipIf(!enabled)('database concurrency and ownership',()=>{
  let actor:ActorRow;let other:ActorRow;
  beforeAll(async()=>{
    actor=(await query<ActorRow>("INSERT INTO players(id,name) VALUES($1,'Integration test') RETURNING *",[randomUUID()])).rows[0];
    other=(await query<ActorRow>("INSERT INTO players(id,name) VALUES($1,'Other integration test') RETURNING *",[randomUUID()])).rows[0];
  });
  afterAll(async()=>{if(actor)await query('DELETE FROM players WHERE id=ANY($1::text[])',[[actor.id,other.id]]);await getPool().end();});
  it('reuses an active lesson and denies another player access',async()=>{
    const first=await startSession(actor,'warung');const again=await startSession(actor,'warung');expect(again.id).toBe(first.id);
    await expect(ownedSession(first.id,other.id)).rejects.toMatchObject({status:404});
    await expect(startSession(actor,'boss')).rejects.toMatchObject({code:'LEVEL_LOCKED'});
  });
  it('serializes simultaneous duplicate turns without duplicate model calls',async()=>{
    const session=await startSession(actor,'warung');const input={id:randomUUID(),text:'Rahajeng semeng'};
    const [a,b]=await Promise.all([addTurn(actor,session.id,input),addTurn(actor,session.id,input)]);
    expect(a.turn.id).toBe(b.turn.id);expect(a.session.turns).toHaveLength(1);expect(b.session.turns).toHaveLength(1);
    expect(roleplay).toHaveBeenCalledTimes(1);
    await expect(addTurn(actor,session.id,{...input,text:'Different text'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
  it('finalizes rewards exactly once across concurrent requests and keeps answers private',async()=>{
    const session=await startSession(actor,'warung');const objectiveIds=lessonById('warung').objectives.map(o=>o.id);
    const quiz=Array.from({length:5},(_,index)=>({id:`q${index}`,type:'choice',prompt:{id:'Uji',en:'Test'},options:['Suksma','A','B','C'],answer:'Suksma',variants:[],sourceId:'fixture',reinforcement:true}));
    await query("UPDATE game_sessions SET status='quiz',completed_objectives=$2,quiz=$3 WHERE id=$1",[session.id,JSON.stringify(objectiveIds),JSON.stringify(quiz)]);
    const publicSession=sessionView(await ownedSession(session.id,actor.id));expect(publicSession.quiz?.[0]).not.toHaveProperty('answer');expect(publicSession.quiz?.[0]).not.toHaveProperty('variants');
    const answers=Object.fromEntries(quiz.map(q=>[q.id,'Suksma']));
    const [a,b]=await Promise.all([completeSession(actor,session.id,answers),completeSession(actor,session.id,answers)]);
    expect(a.result).toEqual(b.result);expect(a.player.xp).toBe(b.player.xp);expect(a.result.quizScore).toBe(5);
    const events=await query('SELECT count(*)::int AS n FROM reward_events WHERE session_id=$1',[session.id]);expect(events.rows[0].n).toBe(1);
  });
  it('finishes retrieval and usage recording using its one available pool connection',async()=>{
    const session=await startSession(actor,'warung');
    const held=await Promise.all(Array.from({length:24},()=>getPool().connect()));
    try {
      // The remaining connection is held by the game transaction. Nested queries must reuse it.
      const result=await addTurn(actor,session.id,{id:randomUUID(),text:'Rahajeng semeng, testing pool saturation.'});
      expect(result.session.turns).toHaveLength(1);
      expect(result.turn.objectiveIds).toContain('warung:greet');
    } finally {for(const client of held)client.release();}
  },15000);
  it('retains paid usage when the gameplay transaction rolls back',async()=>{
    await expect(transaction(async client=>{
      await recordUsage({playerId:actor.id,stage:'rollback_fixture',db:client},'fixture',Date.now(),{usage:{cost:0.01}});
      await client.query("UPDATE players SET name='Should roll back' WHERE id=$1",[actor.id]);
      throw new Error('Invalid provider response');
    })).rejects.toThrow('Invalid provider response');
    const usage=await query('SELECT metadata FROM ai_usage WHERE player_id=$1 AND stage=$2',[actor.id,'rollback_fixture']);
    expect(usage.rows).toHaveLength(1);expect(usage.rows[0].metadata.costUsd).toBe(0.01);
    expect((await query('SELECT name FROM players WHERE id=$1',[actor.id])).rows[0].name).toBe('Integration test');
  });
  it('repairs a legacy reply once across concurrent requests without reassessing or rewarding it',async()=>{
    const session=await startSession(actor,'warung');
    const old={id:randomUUID(),playerText:'Suksma.',reply:'Jagi ngopi napi 茶?',translation:{id:'Mau kopi atau teh?',en:'Coffee or tea?'},corrections:[],objectiveIds:['warung:thank'],assessed:true,createdAt:new Date().toISOString()};
    await query('UPDATE game_sessions SET turns=$2 WHERE id=$1',[session.id,JSON.stringify([old])]);
    const before=await ownedSession(session.id,actor.id);
    vi.mocked(repairReply).mockResolvedValueOnce({reply:'Jagi ngopi napi teh?',translation:old.translation});
    await expect(repairTurnReply(other,session.id,old.id)).rejects.toMatchObject({status:404});
    const [a,b]=await Promise.all([repairTurnReply(actor,session.id,old.id),repairTurnReply(actor,session.id,old.id)]);
    expect(repairReply).toHaveBeenCalledTimes(1);expect(a.turn.reply).toBe(b.turn.reply);
    const after=await ownedSession(session.id,actor.id);
    expect(after.turns[0]).toEqual({...old,reply:'Jagi ngopi napi teh?'});
    for(const key of ['status','completed_objectives','hints_used','quiz','result'] as const)expect(after[key]).toEqual(before[key]);
    expect((await query('SELECT count(*)::int AS n FROM reward_events WHERE session_id=$1',[session.id])).rows[0].n).toBe(0);
  });
  it('reveals a complete sourced hint only once, even across concurrent requests and refresh',async()=>{
    const session=await startSession(actor,'warung');
    const before=await ownedSession(session.id,actor.id);
    await expect(useHint(other,session.id,'warung:farewell')).rejects.toMatchObject({status:404});
    const [a,b]=await Promise.all([useHint(actor,session.id,'warung:farewell'),useHint(actor,session.id,'warung:farewell')]);
    expect(a.hint).toBe('Tiang pamit.');expect(b.hint).toBe('Tiang pamit.');
    const after=await ownedSession(session.id,actor.id);
    expect(after.hints_used).toBe(before.hints_used+1);expect(after.revealed_hints).toContain('warung:farewell');
    expect(sessionView(after).revealedHints).toContain('warung:farewell');
    await expect(useHint(actor,session.id,'invalid')).rejects.toMatchObject({code:'INVALID_OBJECTIVE'});
  });
  it('saves immediate quiz feedback once, hides unchecked answers, and scores the first saved answer',async()=>{
    const session=await startSession(actor,'warung');
    const quiz=[{id:'checked-q',type:'choice' as const,prompt:{id:'Pilih',en:'Choose'},options:['Suksma.','Tiang pamit.'],answer:'Suksma.',variants:[],sourceId:'phrase:warung-07',reinforcement:true}];
    await query("UPDATE game_sessions SET status='quiz',quiz=$2,completed_objectives=$3 WHERE id=$1",[session.id,JSON.stringify(quiz),JSON.stringify(lessonById('warung').objectives.map(item=>item.id))]);
    expect(sessionView(await ownedSession(session.id,actor.id)).quizResponses).toEqual({});
    await expect(checkQuizAnswer(other,session.id,'checked-q','Suksma.')).rejects.toMatchObject({status:404});
    const first=await checkQuizAnswer(actor,session.id,'checked-q','Tiang pamit.');
    expect(first.session.quizResponses?.['checked-q']).toEqual({answer:'Tiang pamit.',correct:false,expectedAnswer:'Suksma.'});
    const retried=await checkQuizAnswer(actor,session.id,'checked-q','Suksma.');
    expect(retried.session.quizResponses).toEqual(first.session.quizResponses);
    const result=await completeSession(actor,session.id,{'checked-q':'Suksma.'});
    expect(result.result.quizScore).toBe(0);
    await expect(checkQuizAnswer(actor,session.id,'unknown','Suksma.')).rejects.toMatchObject({status:404});
    expect((await query('SELECT count(*)::int AS n FROM reward_events WHERE session_id=$1',[session.id])).rows[0].n).toBe(1);
  });
  it('recovers a valid greeting missed in an older turn, while excluding NPC-only evidence',async()=>{
    const session=await startSession(other,'warung');
    const old={id:randomUUID(),playerText:'Om swastiastu, Bu.',reply:'Tiang pamit.',translation:{id:'Saya pamit.',en:'Goodbye.'},corrections:[],objectiveIds:[],assessed:false,createdAt:new Date().toISOString()};
    await query('UPDATE game_sessions SET turns=$2 WHERE id=$1',[session.id,JSON.stringify([old])]);
    vi.mocked(roleplay).mockResolvedValueOnce({reply:'Nggih.',translation:{id:'Ya.',en:'Yes.'},corrections:[],objectiveEvidence:[{objectiveId:'warung:greet',quote:'Om swastiastu'},{objectiveId:'warung:farewell',quote:'Tiang pamit'}]});
    const result=await addTurn(other,session.id,{id:randomUUID(),text:'Tiang nunas teh.'});
    expect(result.session.completedObjectives).toContain('warung:greet');
    expect(result.session.completedObjectives).not.toContain('warung:farewell');
  });
  it('counts unique mistakes mastered only when all questions for that mistake are correct',async()=>{
    const session=await startSession(actor,'warung');
    const quiz=Array.from({length:5},(_,i)=>({id:`mastery-${i}`,type:'choice',prompt:{id:'Pilih',en:'Choose'},options:['Suksma.','Tiang pamit.'],answer:'Suksma.',variants:[],sourceId:'phrase:warung-07',reinforcement:i===4,...(i<4?{mistakeId:i<2?'mistake-a':'mistake-b'}:{})}));
    await query("UPDATE game_sessions SET status='quiz',quiz=$2,completed_objectives=$3 WHERE id=$1",[session.id,JSON.stringify(quiz),JSON.stringify(lessonById('warung').objectives.map(o=>o.id))]);
    const answers=Object.fromEntries(quiz.map((q,i)=>[q.id,i===1?'Tiang pamit.':'Suksma.']));
    const result=await completeSession(actor,session.id,answers);
    expect(result.result.quizScore).toBe(4);
    expect(result.result.mistakesPracticed).toBe(2);
    expect(result.result.mistakesMastered).toBe(1);
  });
  it('records a natural market purchase even if the model omits evidence, once across retries',async()=>{
    const id=randomUUID();await query("INSERT INTO game_sessions(id,player_id,level_id) VALUES($1,$2,'pasar')",[id,actor.id]);
    vi.mocked(roleplay).mockResolvedValueOnce({reply:'Nggih.',translation:{id:'Baik.',en:'Okay.'},corrections:[],objectiveEvidence:[]});
    const input={id:randomUUID(),text:'mau beli pisang dua buku'};
    const a=await addTurn(actor,id,input),b=await addTurn(actor,id,input);
    expect(a.session.completedObjectives).toContain('pasar:quantity');
    expect(b.session.turns).toHaveLength(1);
    expect(b.session.completedObjectives).toEqual(a.session.completedObjectives);
  });
  it('recovers an existing missed market act on owned resume without another turn, hint or reward',async()=>{
    const id=randomUUID(),old={id:randomUUID(),playerText:'mau beli pisang dua buku',reply:'Dados kirang?',translation:{id:'Bisa kurang?',en:'Can it be cheaper?'},corrections:[],objectiveIds:[],assessed:false,createdAt:new Date().toISOString()};
    await query("INSERT INTO game_sessions(id,player_id,level_id,turns) VALUES($1,$2,'pasar',$3)",[id,actor.id,JSON.stringify([old])]);
    const calls=vi.mocked(roleplay).mock.calls.length;
    await expect(loadSession(other,id)).rejects.toMatchObject({status:404});
    const [a,b]=await Promise.all([loadSession(actor,id),loadSession(actor,id)]);
    expect(a.completedObjectives).toEqual(['pasar:quantity']);expect(b.completedObjectives).toEqual(a.completedObjectives);
    const after=await ownedSession(id,actor.id);
    expect(after.turns).toEqual([old]);expect(after.hints_used).toBe(0);
    expect(vi.mocked(roleplay).mock.calls.length).toBe(calls);
    expect((await query('SELECT count(*)::int AS n FROM reward_events WHERE session_id=$1',[id])).rows[0].n).toBe(0);
  });
});
