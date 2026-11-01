import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDemo,DEMO_COOKIE } from '../src/server/actors';
import { query,getPool } from '../src/server/db';
import { ownedSession } from '../src/server/game';
import { writeFile,mkdir } from 'node:fs/promises';
import type { GameSession } from '../src/lib/types';

// Disposable own identity only; credentials/cookies never enter the report.
async function main(){
  const base=process.env.PROBE_URL||'http://localhost:3000';
  const {actor,token}=await createDemo(undefined,{name:'Smart learning verification',locale:'id'});
  const report:{base:string;cases:unknown[];note:string}={base,cases:[],note:'Real OpenRouter HTTP integration and source consistency checks; not native-speaker language validation.'};
  const call=async(path:string,body?:unknown)=>{
    const response=await fetch(`${base}/api/${path}`,{method:body?'POST':'GET',headers:{Cookie:`${DEMO_COOKIE}=${token}`,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const result=await response.json();assert(response.ok,`${path}: ${response.status} ${result.error||''}`);return result;
  };
  try{
    await query('UPDATE players SET stars=$2 WHERE id=$1',[actor.id,JSON.stringify({warung:1,kos:1})]);
    for(const [name,utterances] of [
      ['natural-purchase',['Pak, harga pisang ini berapa?','mau beli pisang dua buku','Kalau lima ribu boleh?']],
      ['context-and-semantics',['Berapa harga pisang ini, Pak?','Yang pisang itu sepasang buat bekal kami, Pak.','Boleh lebih murah sedikit?']],
    ] as const){
      const {session}=await call('sessions',{levelId:'pasar'});const turns:unknown[]=[];let current:GameSession=session;
      for(const text of utterances){
        const id=randomUUID(),started=Date.now();
        const result=await call(`sessions/${session.id}/turns`,{id,text});current=result.session;
        console.log(JSON.stringify({case:name,text,completed:current.completedObjectives}));
        turns.push({text,elapsedMs:Date.now()-started,completed:current.completedObjectives,reply:result.turn.reply,corrections:result.turn.corrections});
        if(text.includes('dua buku')||text.includes('sepasang'))assert(current.completedObjectives.includes('pasar:quantity'),`Natural quantity intent missed: ${JSON.stringify({name,text,reply:result.turn.reply,completed:current.completedObjectives})}`);
        const retry=await call(`sessions/${session.id}/turns`,{id,text});assert.equal(retry.session.turns.length,current.turns.length);
      }
      assert.equal(current.completedObjectives.length,3,'Mission did not finish');
      const resumed=await call(`sessions/${session.id}`);assert.deepEqual(resumed.session.completedObjectives,current.completedObjectives);
      const started=Date.now();const quiz=await call(`sessions/${session.id}/quiz`,{});
      assert.equal(quiz.session.quiz.length,5);assert.equal(new Set(quiz.session.quiz.map((q:{type:string})=>q.type)).size,3);
      assert(quiz.session.quiz.every((q:Record<string,unknown>)=>!('answer'in q)&&!('variants'in q)));
      const privateSession=await ownedSession(session.id,actor.id);
      const answers=Object.fromEntries(privateSession.quiz!.map(q=>[q.id,q.answer]));
      const [a,b]=await Promise.all([call(`sessions/${session.id}/complete`,{answers}),call(`sessions/${session.id}/complete`,{answers})]);
      assert.deepEqual(a.result,b.result);assert.equal(a.result.quizScore,5);
      const rewards=(await query('SELECT count(*)::int AS n FROM reward_events WHERE session_id=$1',[session.id])).rows[0].n;assert.equal(rewards,1);
      report.cases.push({name,turns,quizMs:Date.now()-started,quiz:quiz.session.quiz,result:a.result,retrySafe:true,oneRewardEvent:rewards===1});
    }
    await mkdir('docs/smart-learning',{recursive:true});
    await writeFile('docs/smart-learning/live-http.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({verified:true,base,cases:report.cases.length,report:'docs/smart-learning/live-http.json'}));
  }finally{await query('DELETE FROM players WHERE id=$1 AND auth_user_id IS NULL',[actor.id]);}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Verification failed');process.exitCode=1;}).finally(()=>getPool().end());
