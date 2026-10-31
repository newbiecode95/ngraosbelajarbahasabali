// Opt-in real-provider conversation probe. Uses only its own disposable demo.
import 'dotenv/config';
import { Pool } from 'pg';
import { randomBytes,createHash,randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const base=process.env.PROBE_URL||'http://localhost:3000';let cookie='';
async function call(path,body,method='POST'){const r=await fetch(`${base}/api/${path}`,{method,headers:{Origin:base,Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});if(!r.ok)throw new Error(`${path}: ${r.status} ${JSON.stringify(await r.json())}`);return r;}
const report={lessons:[],date:new Date().toISOString(),environment:base,turns:[],checks:{}};
try{
 const pool=new Pool({connectionString:process.env.DATABASE_URL});const token=randomBytes(32).toString('hex');try{await pool.query("INSERT INTO players(id,name,locale,demo_token_hash,expires_at,stars) VALUES($1,'Conversation audit','id',$2,now()+interval '1 hour',$3)",[randomUUID(),createHash('sha256').update(token).digest('hex'),JSON.stringify({warung:1,kos:1,pasar:1})]);}finally{await pool.end();}cookie='ngraos_demo='+token;
 const session=(await (await call('sessions',{levelId:'warung'})).json()).session;
 for(const text of ['Om swastiastu, Bu. Ada teh hangat?','Tiang nunas teh siki.','Berapa harganya, Bu?','Suksma, Bu.','Tiang pamit.']){
   const began=Date.now();const result=await(await call(`sessions/${session.id}/turns`,{id:randomUUID(),text})).json();report.turns.push({text,reply:result.turn.reply,translation:result.turn.translation.id,objectives:result.session.completedObjectives,corrections:result.turn.corrections,milliseconds:Date.now()-began});
 }
 report.checks.greetingAccepted=report.turns[0].objectives.includes('warung:greet');
 report.checks.allObjectives=report.turns.at(-1).objectives.length===3;
 const quiz=(await(await call(`sessions/${session.id}/quiz`,{})).json()).session.quiz;report.checks.quiz=quiz.length===5;report.checks.noAnswerLeak=quiz.every(q=>!('answer'in q));

 if(process.env.PROBE_ALL_LEVELS==='1')for(const [levelId,texts]of Object.entries({kos:['Wastan tiang Ayu.','Tiang saking Ubud.','Tiang mekarya ring Denpasar.'],pasar:['Om swastiastu. Aji kuda biune?','Tiang nunas kalih biu.','Dados kirang?'],boss:['Om swastiastu, Pak. Wastan tiang Ayu.','Tiang saking Ubud.','Tiang nunas kalih biu. Aji kuda?']})){
   const current=(await(await call('sessions',{levelId})).json()).session;const turns=[];
   for(const text of texts){const data=await(await call('sessions/'+current.id+'/turns',{id:randomUUID(),text})).json();turns.push({text,reply:data.turn.reply,translation:data.turn.translation.id,objectives:data.session.completedObjectives,corrections:data.turn.corrections});}
   report.lessons.push({levelId,turns});report.checks[levelId+'Objectives']=turns.at(-1).objectives.length===3;
   const q=(await(await call('sessions/'+current.id+'/quiz',{})).json()).session.quiz;report.checks[levelId+'Quiz']=q.length===5;
 }
 console.log(JSON.stringify(report,null,2));
 if(process.env.PROBE_REPORT)await writeFile(process.env.PROBE_REPORT,JSON.stringify(report,null,2));
 if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
}finally{if(cookie)await call('player',undefined,'DELETE');}
