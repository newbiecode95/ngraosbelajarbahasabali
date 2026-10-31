// Explicit opt-in probe: uses paid AI calls and removes its temporary demo and recordings.
// Run where ffmpeg exists: PROBE_URL=https://ngraos.docker.anatera.app node scripts/check-production.mjs
import { randomUUID } from 'node:crypto';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);
const base=process.env.PROBE_URL||'https://ngraos.docker.anatera.app';
let cookie='';
const report={date:new Date().toISOString(),environment:base,audio:[],turnMilliseconds:[],limits:{transcriptTargetMilliseconds:3000,replyP90TargetMilliseconds:6000},notes:['Synthetic TTS audio converted with ffmpeg; this does not verify physical Android/iOS microphones or native-speaker accuracy.','One session, sequential requests; this is not a concurrent live-AI load percentile.']};
const directory=await mkdtemp(path.join(tmpdir(),'ngraos-production-probe-'));
async function request(route,body,method='POST') {
  const response=await fetch(`${base}/api/${route}`,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body instanceof FormData?{}:body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(65000)});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(`${route}: HTTP ${response.status}, ${data.error?.code||'unknown error'}`);}
  return response;
}
function isWav(bytes){return bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WAVE';}
try {
  const created=await request('demo',{name:'Voice verification',locale:'id'});
  cookie=created.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const {session}=await(await request('sessions',{levelId:'warung'})).json();
  const opening=Buffer.from(await(await request('speech',{sessionId:session.id,phraseId:'opening'})).arrayBuffer());
  if(!isWav(opening))throw new Error('Protected opening audio is not WAV');
  const input=path.join(directory,'opening.wav');await writeFile(input,opening,{mode:0o600});
  for(const format of [{extension:'webm',mime:'audio/webm',codec:'libopus'},{extension:'mp4',mime:'audio/mp4',codec:'aac'}]) {
    const output=path.join(directory,`input.${format.extension}`);
    await exec('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,'-c:a',format.codec,output],{timeout:15000});
    const bytes=await readFile(output);const form=new FormData();form.set('levelId','warung');form.set('audio',new Blob([bytes],{type:format.mime}),`voice.${format.extension}`);
    const started=Date.now();const transcript=await(await request('transcribe',form)).json();const milliseconds=Date.now()-started;
    if(!transcript.rawTranscript?.trim()||!transcript.normalizedTranscript?.trim())throw new Error('Transcription empty');
    const turnStarted=Date.now();const {turn}=await(await request(`sessions/${session.id}/turns`,{id:randomUUID(),text:transcript.normalizedTranscript,rawTranscript:transcript.rawTranscript})).json();
    const turnMilliseconds=Date.now()-turnStarted;
    const reply=Buffer.from(await(await request('speech',{sessionId:session.id,turnId:turn.id})).arrayBuffer());
    if(!isWav(reply))throw new Error('Protected reply audio is not WAV');
    report.audio.push({input:format.mime,inputBytes:bytes.length,transcriptMilliseconds:milliseconds,transcriptTargetMet:milliseconds<=3000,rawTranscriptPreserved:turn.rawTranscript===transcript.rawTranscript,confirmedTranscriptStored:turn.playerText===transcript.normalizedTranscript,turnMilliseconds,replyWav:true,replyBytes:reply.length});
    console.log(JSON.stringify({stage:'production_audio',...report.audio.at(-1)}));
  }
  for(let i=0;i<10;i++) {
    const started=Date.now();await request(`sessions/${session.id}/turns`,{id:randomUUID(),text:'Rahajeng semeng.'});
    report.turnMilliseconds.push(Date.now()-started);
    console.log(JSON.stringify({stage:'production_turn',sample:i+1,milliseconds:report.turnMilliseconds.at(-1)}));
  }
  const sorted=[...report.turnMilliseconds].sort((a,b)=>a-b);
  report.replyLatency={sampleSize:sorted.length,medianMilliseconds:(sorted[4]+sorted[5])/2,p90NearestRankMilliseconds:sorted[Math.ceil(sorted.length*0.9)-1],targetMet:sorted[Math.ceil(sorted.length*0.9)-1]<=6000};
} finally {
  try{if(cookie){await request('player',undefined,'DELETE');report.temporaryDemoDeleted=true;}}
  finally{await rm(directory,{recursive:true,force:true});report.temporaryAudioDeleted=true;}
}
console.log(JSON.stringify({stage:'production_report',...report},null,2));
