import { test,expect } from '@playwright/test';
import type { GameSession } from '../../src/lib/types';

for(const mode of ['pause','silent','manual-fallback'] as const)test(`quiz recording: ${mode}`,async({page},info)=>{
  await page.addInitScript(mode=>{
    localStorage.setItem('ngraos-preferences',JSON.stringify({muted:true,reduced:true,locale:'id'}));
    if(!navigator.mediaDevices||typeof AudioContext!=='function')return;
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
      const ac=new AudioContext();await ac.resume();
      const oscillator=ac.createOscillator(),gain=ac.createGain(),destination=ac.createMediaStreamDestination();
      gain.gain.value=mode==='silent'?0:.15;
      oscillator.connect(gain);gain.connect(destination);oscillator.start();
      if(mode==='pause')setTimeout(()=>gain.gain.setValueAtTime(0,ac.currentTime),900);
      Object.assign(window,{__quizAudio:ac,__quizTracks:destination.stream.getTracks()});
      if(mode==='manual-fallback')AudioContext.prototype.createAnalyser=()=>{throw new Error('Analyser unavailable');};
      return destination.stream;
    }});
  },mode);
  const id='1ee079ac-b8fe-4df7-ab7b-2c097778be95';
  let session:GameSession={id,levelId:'pasar',status:'quiz',turns:[],completedObjectives:['pasar:price','pasar:quantity','pasar:bargain'],hintsUsed:0,quiz:[{id:'repeat-q',type:'repeat',prompt:{id:'Dengarkan lalu ulangi kalimatnya.',en:'Listen and repeat.'},target:'Tiang nunas biu kalih.',sourceId:'phrase:pasar-08',reinforcement:true}]};
  let transcriptions=0,checks=0;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/player')return route.fulfill({json:{player:{id:'quiz-voice-fixture',name:'Ayu',locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{warung:1,kos:1},albums:[],activeSessionId:id},aiReady:true}});
    if(path===`/api/sessions/${id}`)return route.fulfill({json:{session}});
    if(path==='/api/transcribe'){
      transcriptions++;
      expect(route.request().postDataBuffer()!.length).toBeGreaterThan(300);
      return route.fulfill({json:{rawTranscript:'Tiang nunas biu siki.',normalizedTranscript:'Tiang nunas biu siki.'}});
    }
    if(path.endsWith('/answer')){
      checks++;const body=route.request().postDataJSON();expect(body.answer).toBe('Tiang nunas biu kalih.');
      session={...session,quizResponses:{'repeat-q':{answer:body.answer,correct:true,expectedAnswer:body.answer}}};return route.fulfill({json:{session}});
    }
    return route.fulfill({status:503,json:{error:'Paid API calls blocked by fixture.'}});
  });
  await page.goto('/desa');
  const capture=await page.evaluate(()=>typeof AudioContext==='function'&&typeof MediaRecorder==='function');
  test.skip(!capture,'Windows WebKit lacks capture APIs; no physical iPhone recording pass is claimed.');
  await page.getByRole('button',{name:'Lanjutkan',exact:true}).click();
  await page.getByRole('button',{name:'Mulai merekam',exact:true}).click();
  const stop=page.getByRole('button',{name:'Selesai merekam',exact:true});
  await expect(stop).toBeVisible();
  const input=page.getByLabel('Jawaban ulang-ucap');
  await expect(input).toBeDisabled();
  if(mode==='manual-fallback'){
    await expect(page.locator('.quiz-recording-status')).toContainText('Tekan mikrofon lagi');
    await page.waitForFunction(()=>((window as typeof window & {__quizAudio:AudioContext}).__quizAudio?.currentTime||0)>.8);
    await stop.click();
  }
  if(mode==='silent'){
    await expect(page.locator('.practice-footer [role="alert"]')).toContainText('Belum terdengar suara',{timeout:12000});
    expect(transcriptions).toBe(0);await expect(input).toBeEnabled();await input.fill('Tiang nunas biu kalih.');
  }else{
    // The pause case reaches this point without clicking Stop or Check.
    await expect(input).toHaveValue('Tiang nunas biu siki.',{timeout:12000});
    expect(transcriptions).toBe(1);expect(checks).toBe(0);
    await input.fill('Tiang nunas biu kalih.');
  }
  expect(checks).toBe(0);
  expect(await page.evaluate(()=>(window as typeof window & {__quizTracks:MediaStreamTrack[]}).__quizTracks.every(t=>t.readyState==='ended'))).toBe(true);
  await page.screenshot({path:info.outputPath('editable-quiz-transcript.png'),fullPage:true});
  await page.getByRole('button',{name:'Periksa jawaban',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tepat!',exact:true})).toBeVisible();expect(checks).toBe(1);
  await page.evaluate(()=>(window as typeof window & {__quizAudio:AudioContext}).__quizAudio.close());
});
