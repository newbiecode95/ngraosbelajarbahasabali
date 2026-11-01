import { createHash,randomUUID } from 'node:crypto';
import { mkdtemp,readFile,writeFile,rm,mkdir,stat,readdir,unlink,rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AppError } from './errors';
import { models } from './config';
import { synthesize } from './openrouter';
import { hasUnexpectedLearningScript } from '../lib/learning-text';
const exec=promisify(execFile);
export async function normalizeRecording(file:File) {
  if(file.size<100||file.size>8*1024*1024) throw new AppError(400,'INVALID_AUDIO_SIZE','Rekaman harus berisi suara dan berukuran maksimal 8 MB.');
  const dir=await mkdtemp(path.join(tmpdir(),'ngraos-recording-'));
  try {
    const input=path.join(dir,'input');const output=path.join(dir,'normalized.wav');
    await writeFile(input,Buffer.from(await file.arrayBuffer()),{mode:0o600});
    try { await exec(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,'-vn','-t','31','-ac','1','-ar','16000','-c:a','pcm_s16le',output],{timeout:20_000,maxBuffer:512*1024,windowsHide:true}); }
    catch { throw new AppError(422,'AUDIO_CONVERSION_FAILED','Format rekaman belum dapat dibaca. Coba rekam lagi atau gunakan mode ketik.',true); }
    const wav=await readFile(output);
    if(wav.length<3244) throw new AppError(422,'AUDIO_TOO_SHORT','Rekaman terlalu singkat. Coba bicara sedikit lebih lama.',true);
    if(wav.length>30*16000*2+1024) throw new AppError(422,'AUDIO_TOO_LONG','Batasi satu giliran bicara hingga 30 detik.');
    return wav;
  } finally { await rm(dir,{recursive:true,force:true}); }
}
const pendingAudio=new Map<string,Promise<Buffer>>();
export async function cachedSpeech(text:string,voice:string,playerId?:string,safeToCache=true) {
  if(hasUnexpectedLearningScript(text))throw new AppError(409,'REPLY_NEEDS_REPAIR','Balasan ini perlu diperbaiki sebelum dibacakan.',true);
  if(!safeToCache) {
    try{return await synthesize(text,voice,playerId);}
    catch(error){if(process.env.AI_TTS_FALLBACK_ENABLED!=='true')throw error;return synthesize(text,voice,playerId,models().ttsFallback);}
  }
  const model=models().tts;const key=createHash('sha256').update(JSON.stringify({text,voice,model,style:'balinese-warm-slow-v1'})).digest('hex');
  const directory=process.env.MEDIA_CACHE_DIR||path.join(tmpdir(),'ngraos-tts-cache');
  const filename=path.join(directory,`${key}.wav`);
  try { const info=await stat(/* turbopackIgnore: true */ filename);if(Date.now()-info.mtimeMs<7*86400_000) return await readFile(/* turbopackIgnore: true */ filename); } catch { /* cache miss */ }
  if(pendingAudio.has(key)) return pendingAudio.get(key)!;
  const task=(async()=>{
    let bytes:Buffer;let fallbackUsed=false;
    try { bytes=await synthesize(text,voice,playerId,model); }
    catch(error) {
      if(process.env.AI_TTS_FALLBACK_ENABLED!=='true') throw error;
      bytes=await synthesize(text,voice,playerId,models().ttsFallback);fallbackUsed=true;
    }
    if(fallbackUsed)return bytes;
    await mkdir(directory,{recursive:true});const temporary=path.join(directory,`${key}.${randomUUID()}.partial`);await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,filename);
    // Bound the cache; no player recordings are ever put in this directory.
    const files=await readdir(/* turbopackIgnore: true */ directory);
    if(files.length>1000) {
      const oldest=await Promise.all(files.filter(f=>/^[a-f0-9]{64}\.wav$/.test(f)).map(async f=>({name:f,time:(await stat(/* turbopackIgnore: true */ path.join(directory,f))).mtimeMs})));
      await Promise.all(oldest.sort((a,b)=>a.time-b.time).slice(0,Math.max(1,files.length-900)).map(f=>unlink(/* turbopackIgnore: true */ path.join(directory,f.name)).catch(()=>{})));
    }
    return bytes;
  })().finally(()=>pendingAudio.delete(key));
  pendingAudio.set(key,task);return task;
}
