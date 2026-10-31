import { test, expect, type Page, type TestInfo } from '@playwright/test';

const id='7a00a3c0-e162-4d20-b6fd-ed4ffb96a471';
const emptySession={id,levelId:'warung',status:'active',turns:[],completedObjectives:[],hintsUsed:0};
async function mediaApp(page:Page) {
  await page.addInitScript(()=>localStorage.setItem('ngraos-preferences',JSON.stringify({muted:false,reduced:true,locale:'id'})));
  // Block every unmatched API request; these media tests never reach a paid provider.
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/player')return route.fulfill({json:{player:{id:'media-fixture',name:'Ayu',locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]},aiReady:true}});
    if(path==='/api/sessions')return route.fulfill({json:{session:emptySession}});
    return route.fulfill({status:503,json:{error:'Provider requests disabled in media acceptance tests.',code:'E2E_AI_BLOCKED'}});
  });
}
async function capabilities(page:Page,testInfo:TestInfo) {
  const value=await page.evaluate(()=>({
    secureContext:isSecureContext,mediaDevices:typeof navigator.mediaDevices,recorder:typeof MediaRecorder,
    audioContext:typeof AudioContext,webkitAudioContext:typeof (window as typeof window & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext,
    wavPlaybackClaim:new Audio().canPlayType('audio/wav'),
    codecs:['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].map(mime=>({mime,supported:typeof MediaRecorder==='function'&&MediaRecorder.isTypeSupported(mime)})),
  }));
  await testInfo.attach('engine-capabilities',{body:JSON.stringify(value,null,2),contentType:'application/json'});
  return value;
}
function toneWav(seconds=3) {
  const rate=24000,samples=rate*seconds,bytes=Buffer.alloc(44+samples*2);
  bytes.write('RIFF',0);bytes.writeUInt32LE(36+samples*2,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++) bytes.writeInt16LE(Math.round(Math.sin(i/rate*2*Math.PI*220)*3500),44+i*2);
  return bytes;
}

test('synthetic microphone records a real container and leaves the transcript editable',async({page},testInfo)=>{
  await mediaApp(page);
  await page.addInitScript(()=>{
    if(!navigator.mediaDevices)return;
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      const audio=new AudioContext();await audio.resume();
      const oscillator=audio.createOscillator(),gain=audio.createGain(),destination=audio.createMediaStreamDestination();
      oscillator.frequency.value=220;gain.gain.value=0.1;oscillator.connect(gain);gain.connect(destination);oscillator.start();
      Object.assign(window,{__fixtureAudio:audio,__fixtureTracks:destination.stream.getTracks()});
      return destination.stream;
    }});
  });
  let recording:{type:string;size:number;name:string}|undefined;
  await page.route('**/api/transcribe',async route=>{
    const body=route.request().postDataBuffer()!;
    const form=await new Response(Uint8Array.from(body),{headers:{'Content-Type':route.request().headers()['content-type']}}).formData();
    const file=form.get('audio') as File;
    recording={type:file.type,size:file.size,name:file.name};
    expect(form.get('levelId')).toBe('warung');
    await testInfo.attach('synthetic-recording',{body:Buffer.from(await file.arrayBuffer()),contentType:file.type});
    await route.fulfill({json:{rawTranscript:'Rahajeng   semeng.',normalizedTranscript:'Rahajeng semeng.'}});
  });
  await page.goto('/');
  const support=await capabilities(page,testInfo);
  test.skip(support.recorder!=='function'||support.audioContext!=='function','This host browser build has no MediaRecorder/AudioContext. No recording or native-device pass is claimed.');
  await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await page.getByRole('button',{name:'Mulai merekam',exact:true}).click();
  await expect(page.getByRole('button',{name:'Selesai merekam',exact:true})).toBeVisible();
  await page.waitForFunction(()=>((window as typeof window & {__fixtureAudio?:AudioContext}).__fixtureAudio?.currentTime??0)>0.8);
  await page.getByRole('button',{name:'Selesai merekam',exact:true}).click();
  const transcript=page.getByLabel('Periksa ucapanmu sebelum dikirim');
  await expect(transcript).toHaveValue('Rahajeng semeng.');
  expect(recording?.size).toBeGreaterThan(300);
  expect(recording?.type).toMatch(/^audio\/(webm|mp4|ogg)/);
  await transcript.fill('Suksma.');await expect(transcript).toHaveValue('Suksma.');
  expect(await page.evaluate(()=>(window as typeof window & {__fixtureTracks:MediaStreamTrack[]}).__fixtureTracks.every(track=>track.readyState==='ended'))).toBe(true);
  await page.evaluate(()=>(window as typeof window & {__fixtureAudio:AudioContext}).__fixtureAudio.close());
  await testInfo.attach('recording-container',{body:JSON.stringify(recording,null,2),contentType:'application/json'});
});

test('audio failure recovers to real WAV playback and animated speaking state',async({page},testInfo)=>{
  await mediaApp(page);let requests=0;
  await page.route('**/api/speech',route=>{
    requests++;
    if(requests===1)return route.fulfill({status:503,json:{error:'Audio sementara tidak tersedia. Coba lagi.'}});
    return route.fulfill({contentType:'audio/wav',body:toneWav()});
  });
  await page.goto('/');
  const support=await capabilities(page,testInfo);
  test.skip(support.audioContext!=='function','This host browser build has no Web Audio API; real playback/analyser integration cannot be validated here.');
  await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await page.getByRole('button',{name:'Dengarkan',exact:true}).click();
  await expect(page.locator('.audio-notice')).toContainText('Audio sementara tidak tersedia');
  await page.getByRole('button',{name:'Dengarkan',exact:true}).click();
  await expect(page.locator('.scene-npc')).toHaveClass(/speaking/);
  await page.waitForFunction(()=>Number((document.querySelector('.scene-npc') as HTMLElement)?.style.getPropertyValue('--mouth'))>0,{},{timeout:5000});
  await expect(page.locator('.scene-npc')).not.toHaveClass(/speaking/,{timeout:8000});
  await expect(page.getByRole('button',{name:'Dengarkan',exact:true})).toBeEnabled();
  expect(requests).toBe(2);
});

test('each advertised recorder codec produces playable synthetic audio',async({page},testInfo)=>{
  await mediaApp(page);await page.goto('/');
  const support=await capabilities(page,testInfo);
  test.skip(support.recorder!=='function'||support.audioContext!=='function','This host browser build exposes no recorder/Web Audio codecs. This is not an iOS compatibility pass.');
  await page.evaluate(()=>{
    type Result={mime:string;supported:boolean;actualType?:string;bytes?:number;played?:boolean;error?:string};
    const state=window as typeof window & {__codecResults?:Result[]};
    const button=document.createElement('button');button.textContent='Run codec checks';
    Object.assign(button.style,{position:'fixed',top:'100px',right:'20px',zIndex:'99999',padding:'12px',background:'#fff',border:'1px solid #555'});
    document.body.prepend(button);
    button.onclick=async()=>{
      const results:Result[]=[];const context=new AudioContext();await context.resume();
      const tone=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
      tone.frequency.value=220;gain.gain.value=0.1;tone.connect(gain);gain.connect(destination);tone.start();
      for(const mime of ['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus']) {
        if(!MediaRecorder.isTypeSupported(mime)){results.push({mime,supported:false});continue;}
        let audio:HTMLAudioElement|undefined;let url:string|undefined;
        try {
          const recorder=new MediaRecorder(destination.stream,{mimeType:mime});const chunks:BlobPart[]=[];
          recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
          const stopped=new Promise<void>(resolve=>{recorder.onstop=()=>resolve();});
          recorder.start();await new Promise(resolve=>setTimeout(resolve,700));recorder.stop();await stopped;
          const blob=new Blob(chunks,{type:recorder.mimeType});url=URL.createObjectURL(blob);audio=new Audio(url);audio.muted=true;
          await Promise.race([audio.play(),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('Playback start timeout')),5000))]);
          const player=audio;
          await new Promise<void>((resolve,reject)=>{
            const started=performance.now();const timer=setInterval(()=>{
              if(player.currentTime>0.1){clearInterval(timer);resolve();}
              else if(player.error||performance.now()-started>5000){clearInterval(timer);reject(new Error(player.error?.message||'Playback progress timeout'));}
            },50);
          });
          results.push({mime,supported:true,actualType:recorder.mimeType,bytes:blob.size,played:true});
        } catch(error){results.push({mime,supported:true,error:error instanceof Error?error.message:String(error)});}
        finally {audio?.pause();if(url)URL.revokeObjectURL(url);}
      }
      tone.stop();destination.stream.getTracks().forEach(track=>track.stop());await context.close();state.__codecResults=results;
    };
  });
  await page.getByRole('button',{name:'Run codec checks',exact:true}).click();
  await page.waitForFunction(()=>Array.isArray((window as typeof window & {__codecResults?:unknown[]}).__codecResults),{},{timeout:30_000});
  const results=await page.evaluate(()=>(window as typeof window & {__codecResults:{mime:string;supported:boolean;actualType?:string;bytes?:number;played?:boolean;error?:string}[]}).__codecResults);
  await testInfo.attach('codec-results',{body:JSON.stringify(results,null,2),contentType:'application/json'});
  const supported=results.filter(result=>result.supported);expect(supported.length).toBeGreaterThan(0);
  for(const result of supported){expect(result.error,`${result.mime}: ${result.error}`).toBeUndefined();expect(result.bytes).toBeGreaterThan(300);expect(result.played).toBe(true);}
});

test('unavailable microphone APIs keep manual typing available',async({page})=>{
  await mediaApp(page);
  await page.addInitScript(()=>Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:undefined}));
  await page.goto('/');await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await page.getByRole('button',{name:'Mulai merekam',exact:true}).click();
  await expect(page.locator('.composer [role="alert"]')).toContainText('Gunakan mode ketik');
  await page.getByRole('button',{name:'Ketik',exact:true}).click();
  await page.getByLabel('Apa yang ingin kamu katakan?').fill('Suksma.');
  await expect(page.getByRole('button',{name:'Kirim ucapan'})).toBeEnabled();
});
