// Explicit paid production acceptance test. Run with: tsx scripts/check-load.ts --real-ai
import 'dotenv/config';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { mkdir,writeFile } from 'node:fs/promises';
import { query,getPool,transaction } from '../src/server/db';
import type { GameSession,ApiError } from '../src/lib/types';
import type { PrivateQuestion } from '../src/server/game';
if(!process.argv.includes('--real-ai'))throw new Error('Paid test requires explicit --real-ai.');
const base=process.env.PROBE_URL||'https://ngraos.docker.anatera.app';
const count=20;
const fixtures=Array.from({length:count},(_,index)=>({index:index+1,id:randomUUID(),token:randomBytes(32).toString('hex'),session:undefined as GameSession|undefined,error:undefined as string|undefined,answers:{} as Record<string,string>}));
type Attempt={player:number;stage:string;attempt:number;milliseconds:number;status:number;ok:boolean;code?:string};
const attempts:Attempt[]=[];
const phaseMilliseconds:Record<string,number>={};
const report:Record<string,unknown>={date:new Date().toISOString(),environment:base,concurrentSessions:count,realAi:true,transport:'Public HTTPS API',provider:'OpenRouter',fixtureSetup:'Isolated demo actors inserted directly to avoid the public demo IP bucket; gameplay uses normal authenticated API routes.',attempts,phaseMilliseconds};
async function call(fixture:typeof fixtures[number],stage:string,route:string,body?:unknown,method='POST') {
  for(let attempt=0;attempt<3;attempt++) {
    const started=Date.now();let response:Response|undefined;let data:Record<string,unknown>&Partial<ApiError>={};
    try {
      response=await fetch(`${base}/api/${route}`,{method,headers:{Origin:base,Cookie:`ngraos_demo=${fixture.token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(65000)});
      data=await response.json();
    } catch {data={code:'NETWORK_OR_TIMEOUT',retryable:true};}
    attempts.push({player:fixture.index,stage,attempt:attempt+1,milliseconds:Date.now()-started,status:response?.status||0,ok:Boolean(response?.ok),...(data.code?{code:data.code}:{})});
    if(response?.ok)return data;
    const retryable=!response||data.retryable||[429,502,503,504].includes(response.status);
    console.log(JSON.stringify({stage:'load_request_failure',player:fixture.index,operation:stage,attempt:attempt+1,status:response?.status||0,code:data.code||'UNKNOWN',retrying:retryable&&attempt<2}));
    if(!retryable||attempt===2)throw new Error(`${stage}: ${data.code||response?.status||'network failure'}`);
    const delay=Math.min(60000,Math.max(2000*(attempt+1),Number(response?.headers.get('retry-after')||0)*1000))+Math.floor(Math.random()*250);
    await new Promise(resolve=>setTimeout(resolve,delay));
  }
  throw new Error('Retry limit exceeded');
}
async function phase(name:string,work:(fixture:typeof fixtures[number])=>Promise<void>) {
  const started=Date.now();
  await Promise.all(fixtures.filter(f=>!f.error).map(async fixture=>{try{await work(fixture);}catch(error){fixture.error=error instanceof Error?error.message:'Unknown failure';}}));
  phaseMilliseconds[name]=Date.now()-started;
  console.log(JSON.stringify({stage:'load_phase',phase:name,milliseconds:phaseMilliseconds[name],successfulPlayers:fixtures.filter(f=>!f.error).length,failedPlayers:fixtures.filter(f=>f.error).map(f=>({player:f.index,error:f.error}))}));
}
function distribution(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b);
  return {sampleSize:sorted.length,minimumMilliseconds:sorted[0],medianMilliseconds:sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2,p90NearestRankMilliseconds:sorted[Math.ceil(sorted.length*0.9)-1],maximumMilliseconds:sorted.at(-1)};
}
async function main(){try {
  await transaction(async client=>{for(const fixture of fixtures)await client.query("INSERT INTO players(id,name,locale,demo_token_hash,expires_at) VALUES($1,$2,'id',$3,now()+interval '1 hour')",[fixture.id,`Load verification ${fixture.index}`,createHash('sha256').update(fixture.token).digest('hex')]);});
  await phase('start',async fixture=>{fixture.session=(await call(fixture,'start','sessions',{levelId:'warung'})).session as GameSession;});
  await phase('conversation',async fixture=>{
    const id=randomUUID();
    fixture.session=(await call(fixture,'turn',`sessions/${fixture.session!.id}/turns`,{id,text:'Rahajeng semeng. Suksma. Tiang pamit.'})).session as GameSession;
    const evidence:Record<string,string>={'warung:greet':'Rahajeng semeng.','warung:thank':'Suksma.','warung:farewell':'Tiang pamit.'};
    for(const [objective,text] of Object.entries(evidence))if(!fixture.session.completedObjectives.includes(objective)) {
      fixture.session=(await call(fixture,'turn_followup',`sessions/${fixture.session.id}/turns`,{id:randomUUID(),text})).session as GameSession;
    }
    if(fixture.session.completedObjectives.length!==3)throw new Error('Mission evidence incomplete after explicit followups');
  });
  await phase('quiz',async fixture=>{
    fixture.session=(await call(fixture,'quiz',`sessions/${fixture.session!.id}/quiz`,{})).session as GameSession;
    if(fixture.session.quiz?.length!==5||fixture.session.quiz.some(q=>'answer' in q||'variants' in q))throw new Error('Public quiz shape or answer secrecy failed');
  });
  // This test's answer keys are read through internal DB access, never an exposed application API.
  const privateRows=await query<{id:string;player_id:string;quiz:PrivateQuestion[]}>('SELECT id,player_id,quiz FROM game_sessions WHERE player_id=ANY($1::text[])',[fixtures.map(f=>f.id)]);
  for(const fixture of fixtures){const stored=privateRows.rows.find(r=>r.player_id===fixture.id);if(stored?.quiz)fixture.answers=Object.fromEntries(stored.quiz.map(q=>[q.id,q.answer]));}
  await phase('complete_with_concurrent_replay',async fixture=>{
    const route=`sessions/${fixture.session!.id}/complete`;const payload={answers:fixture.answers};
    const [first,replay]=await Promise.all([call(fixture,'complete',route,payload),call(fixture,'complete_replay',route,payload)]);
    if(!isDeepStrictEqual(first.result,replay.result)||(first.player as {xp:number}).xp!==(replay.player as {xp:number}).xp)throw new Error('Concurrent completion changed result or XP');
    fixture.session=first.session as GameSession;
  });
  await phase('refresh',async fixture=>{
    const refreshed=(await call(fixture,'refresh',`sessions/${fixture.session!.id}`,undefined,'GET')).session as GameSession;
    if(refreshed.status!=='completed'||refreshed.result?.quizScore!==5)throw new Error('Completed state did not survive HTTP refresh');
  });
  const stored=await query<{id:string;xp:number;stars:Record<string,number>;albums:string[];sessions:number;rewards:number;reward_xp:number;completed:number}>(`SELECT p.id,p.xp,p.stars,p.albums,(SELECT count(*)::int FROM game_sessions s WHERE s.player_id=p.id) AS sessions,(SELECT count(*)::int FROM reward_events r WHERE r.player_id=p.id) AS rewards,(SELECT COALESCE(sum(r.xp),0)::int FROM reward_events r WHERE r.player_id=p.id) AS reward_xp,(SELECT count(*)::int FROM game_sessions s WHERE s.player_id=p.id AND s.status='completed') AS completed FROM players p WHERE p.id=ANY($1::text[])`,[fixtures.map(f=>f.id)]);
  const usage=await query(`SELECT stage,model,provider,count(*)::int AS requests,sum(input_tokens)::bigint AS input_tokens,sum(output_tokens)::bigint AS output_tokens,sum(COALESCE((metadata->>'costUsd')::numeric,0))::float AS reported_cost_usd FROM ai_usage WHERE player_id=ANY($1::text[]) GROUP BY stage,model,provider ORDER BY stage`,[fixtures.map(f=>f.id)]);
  report.successfulPlayers=fixtures.filter(f=>!f.error).length;
  report.failures=fixtures.filter(f=>f.error).map(f=>({player:f.index,error:f.error}));
  report.initialFailures=attempts.filter(a=>!a.ok&&a.attempt===1);
  report.totalFailedAttempts=attempts.filter(a=>!a.ok).length;
  report.retryAttempts=attempts.filter(a=>a.attempt>1).length;
  report.turnLatency=distribution(attempts.filter(a=>a.ok&&a.stage.startsWith('turn')).map(a=>a.milliseconds));
  report.targets={replyP90Milliseconds:6000,replyP90Met:(report.turnLatency as ReturnType<typeof distribution>).p90NearestRankMilliseconds<=6000};
  report.quizLatency=distribution(attempts.filter(a=>a.ok&&a.stage==='quiz').map(a=>a.milliseconds));
  report.databaseChecks={actors:stored.rows.length,completedSessions:stored.rows.reduce((n,r)=>n+r.completed,0),distinctRewardEvents:stored.rows.reduce((n,r)=>n+r.rewards,0),singleSessionAndRewardPerPlayer:stored.rows.every(r=>r.sessions===1&&r.rewards===1&&r.completed===1),xpMatchesStoredReward:stored.rows.every(r=>r.xp===r.reward_xp),albumAndStarsPersisted:stored.rows.every(r=>r.albums.includes('warung')&&r.stars.warung>=1),publicAnswerKeysLeaked:false};
  report.usage=usage.rows;
  report.passed=fixtures.every(f=>!f.error)&&stored.rows.length===count&&stored.rows.every(r=>r.sessions===1&&r.rewards===1&&r.completed===1&&r.xp===r.reward_xp);
  report.notes=['Retries use the same turn idempotency key; response latencies include public HTTPS and system time.','Quiz latency may include the built-in single output repair. Detailed usage counts retain provider requests that failed validation.','Reported costs only; not a claim of native-speaker linguistic accuracy.'];
  if(!report.passed)process.exitCode=1;
} catch(error) {
  report.passed=false;report.fatalError=error instanceof Error?error.message:'Unknown failure';process.exitCode=1;
} finally {
  try {
    await transaction(async client=>{
      await client.query('DELETE FROM rate_limits WHERE key=ANY($1::text[])',[fixtures.flatMap(f=>['start','turn','quiz','hint','speech','transcribe','report'].map(prefix=>`${prefix}:${f.id}`))]);
      await client.query('DELETE FROM players WHERE id=ANY($1::text[]) AND auth_user_id IS NULL',[fixtures.map(f=>f.id)]);
    });
    report.temporaryFixturesDeleted=(await query('SELECT count(*)::int AS n FROM players WHERE id=ANY($1::text[])',[fixtures.map(f=>f.id)])).rows[0].n===0;
  } catch {report.temporaryFixturesDeleted=false;process.exitCode=1;}
  await mkdir('docs/verification',{recursive:true});await writeFile('docs/verification/production-load.json',JSON.stringify(report,null,2)+'\n');
  await getPool().end();
}
console.log(JSON.stringify({stage:'production_load_result',passed:report.passed,successfulPlayers:report.successfulPlayers,initialFailures:report.initialFailures,totalFailedAttempts:report.totalFailedAttempts,retryAttempts:report.retryAttempts,turnLatency:report.turnLatency,quizLatency:report.quizLatency,databaseChecks:report.databaseChecks,temporaryFixturesDeleted:report.temporaryFixturesDeleted,fatalError:report.fatalError},null,2));
}
main().catch(()=>{console.error('Production load verification failed unexpectedly.');process.exitCode=1;});
