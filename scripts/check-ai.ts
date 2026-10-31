import 'dotenv/config';
import { models, aiReady } from '../src/server/config';
import { modelCatalog, chatJson, synthesize,transcribe } from '../src/server/openrouter';
import { z } from 'zod';
import { getPool } from '../src/server/db';
import { lessonById } from '../src/server/content';
import { createDemo } from '../src/server/actors';
import { addTurn,completeSession,ownedSession,prepareQuiz,startSession } from '../src/server/game';
import { query } from '../src/server/db';
import { randomUUID,randomBytes } from 'node:crypto';
import type { LevelId } from '../src/lib/types';
async function main() {
  const catalog=await modelCatalog();const selected=models();
  const report=Object.entries(selected).map(([task,id])=>{const model=catalog.find(m=>m.id===id);return {task,id,available:Boolean(model),input:model?.architecture?.input_modalities,output:model?.architecture?.output_modalities};});
  console.log(JSON.stringify({credentialConfigured:aiReady(),models:report},null,2));
  if(report.some(m=>!m.available))process.exitCode=1;
  if(process.argv.includes('--smoke')) {
    const answer=await chatJson(selected.roleplay,[{role:'user',content:'Return {"ok":true}.'}],{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},z.object({ok:z.boolean()}),{stage:'smoke'});
    const audio=await synthesize('Suksma.', 'Sulafat',undefined,selected.tts);
    console.log(JSON.stringify({structuredOutput:answer.ok,audioBytes:audio.length,wav:audio.subarray(0,4).toString()==='RIFF'}));
    if(process.argv.includes('--roundtrip')){const result=await transcribe(audio,lessonById('warung'),'');console.log(JSON.stringify({syntheticAudioRoundtrip:result.normalizedTranscript,note:'Integration smoke only, not a native-speaker accuracy evaluation.'}));}
    if(process.argv.includes('--fallback')){const fallback=await synthesize('Suksma.','Sulafat',undefined,selected.ttsFallback);console.log(JSON.stringify({fallbackAudioBytes:fallback.length,wav:fallback.subarray(0,4).toString()==='RIFF'}));}
  }
  if(process.argv.includes('--game')||process.argv.includes('--all-levels')) {
    const {actor}=await createDemo();
    try {
      const cases:Record<LevelId,string[]>={warung:['Rahajeng semeng, Men Sari. Suksmi.','Suksma.','Tiang pamit.'],kos:['Wastan tiang Rian.','Tiang saking Surabaya.','Tiang mekarya ring kafe.'],pasar:['Aji kuda biu niki?','Tiang nunas biu kalih.','Dados kirang?'],boss:['Rahajeng semeng.','Wastan tiang Rian. Tiang saking Surabaya.','Aji kuda poh niki?']};
      for(const levelId of (process.argv.includes('--all-levels')?['warung','kos','pasar','boss']:['warung']) as LevelId[]) {
        const session=await startSession(actor,levelId);
        for(const text of cases[levelId]) {
          const started=Date.now();const result=await addTurn(actor,session.id,{id:randomUUID(),text});
          console.log(JSON.stringify({stage:'live_turn',levelId,milliseconds:Date.now()-started,objectives:result.session.completedObjectives,supportedCorrections:result.turn.corrections.filter(c=>c.supported).length}));
        }
        const quizStarted=Date.now();const quiz=await prepareQuiz(actor,session.id);const stored=await ownedSession(session.id,actor.id);
        const result=await completeSession(actor,session.id,Object.fromEntries(stored.quiz!.map(q=>[q.id,q.answer])));
        const repeat=await completeSession(actor,session.id,Object.fromEntries(stored.quiz!.map(q=>[q.id,q.answer])));
        console.log(JSON.stringify({stage:'live_game_complete',levelId,quizMilliseconds:Date.now()-quizStarted,questionTypes:quiz.quiz?.map(q=>q.type),mistakeQuestions:quiz.quiz?.filter(q=>!q.reinforcement).length,result:result.result,idempotent:result.player.xp===repeat.player.xp}));
      }
    } finally {await query('DELETE FROM players WHERE id=$1 AND auth_user_id IS NULL',[actor.id]);}
  }
  if(process.argv.includes('--http-auth')) {
    const base=process.env.PROBE_URL||'http://localhost:3000';
    const identities=[0,1].map(()=>({name:'HTTP verification',email:`verify-${randomBytes(10).toString('hex')}@ngraos.invalid`,password:randomBytes(24).toString('base64url'),cookie:'',userId:''}));
    const call=async(path:string,method:string,cookie='',body?:unknown)=>fetch(`${base}/api/${path}`,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    try {
      for(const identity of identities){const response=await call('auth/sign-up/email','POST','',{name:identity.name,email:identity.email,password:identity.password});if(!response.ok)throw new Error(`HTTP signup failed: ${response.status}`);identity.userId=(await response.json()).user.id;identity.cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
      const [a,b]=identities;
      const created=await call('sessions','POST',a.cookie,{levelId:'warung'});if(!created.ok)throw new Error(`HTTP session creation failed: ${created.status}`);const sessionId=(await created.json()).session.id;
      const forbidden=await call(`sessions/${sessionId}`,'GET',b.cookie);const admin=await call('admin','GET',a.cookie);
      if(forbidden.status!==404||admin.status!==403)throw new Error('HTTP authorization boundary failed');
      const signout=await call('auth/sign-out','POST',a.cookie,{});if(!signout.ok)throw new Error(`HTTP signout failed: ${signout.status}`);
      const signedOut=await(await call('player','GET',a.cookie)).json();if(signedOut.player!==null)throw new Error('Signed-out token remained active');
      const login=await call('auth/sign-in/email','POST','',{email:a.email,password:a.password});if(!login.ok)throw new Error(`HTTP signin failed: ${login.status}`);a.cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
      const deleted=await call('player','DELETE',a.cookie);if(!deleted.ok)throw new Error('HTTP deletion failed');
      const afterDeletion=await(await call('player','GET',a.cookie)).json();if(afterDeletion.player!==null)throw new Error('Deleted account remained accessible');
      console.log(JSON.stringify({stage:'http_auth',signup:true,signin:true,signout:true,accountDeletion:true,crossAccountDenied:forbidden.status===404,nonAdminDenied:admin.status===403}));
    } finally {for(const identity of identities)if(identity.userId)await query('DELETE FROM "user" WHERE id=$1',[identity.userId]);}
  }
}
main().catch(error=>{console.error('AI check failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;}).finally(async()=>{if(process.env.DATABASE_URL)await getPool().end();});
