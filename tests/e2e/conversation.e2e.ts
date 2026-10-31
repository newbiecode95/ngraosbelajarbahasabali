import { test,expect } from '@playwright/test';
const id='0cb123e2-7867-491b-96c4-d8da72d7e203';
function wav(){const rate=24000,n=rate*2,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(4000*Math.sin(i*440*Math.PI/rate)),44+i*2);return b;}
test('voice sends after silence, auto-plays the final reply, and lets the learner choose when to start the quiz',async({page},info)=>{
  const session={id,levelId:'warung',status:'active',turns:[],completedObjectives:[],hintsUsed:0};let sent=0,quiz=0;const speech:string[]=[];
  await page.addInitScript(()=>{localStorage.setItem('ngraos-preferences',JSON.stringify({muted:false,reduced:false,locale:'id'}));if(!navigator.mediaDevices)return;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const ac=new AudioContext();await ac.resume();const oscillator=ac.createOscillator(),gain=ac.createGain(),destination=ac.createMediaStreamDestination();gain.gain.value=.15;oscillator.connect(gain);gain.connect(destination);oscillator.start();setTimeout(()=>gain.gain.setValueAtTime(0,ac.currentTime),900);destination.stream.getTracks()[0].addEventListener('ended',()=>void ac.close());return destination.stream;}});});
  await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;
    if(path==='/api/player')return route.fulfill({json:{player:{id:'voice-test',name:'Ayu',locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]},aiReady:true}});
    if(path==='/api/sessions')return route.fulfill({json:{session}});
    if(path==='/api/transcribe')return route.fulfill({json:{rawTranscript:'Om swastiastu. Suksma. Tiang pamit.',normalizedTranscript:'Om swastiastu. Suksma. Tiang pamit.'}});
    if(path.endsWith('/turns')){sent++;const body=route.request().postDataJSON();expect(body.rawTranscript).toBe('Om swastiastu. Suksma. Tiang pamit.');const turn={id:body.id,playerText:body.text,reply:'Nggih. Rahajeng margi.',translation:{id:'Ya. Selamat jalan.',en:'Yes. Have a good journey.'},corrections:[],objectiveIds:['warung:greet','warung:thank','warung:farewell'],createdAt:new Date().toISOString()};return route.fulfill({json:{turn,session:{...session,turns:[turn],completedObjectives:turn.objectiveIds}}});}
    if(path==='/api/speech'){const body=route.request().postDataJSON();speech.push(body.turnId?'reply':'opening');return route.fulfill({contentType:'audio/wav',body:wav()});}
    if(path.endsWith('/quiz')){quiz++;return route.fulfill({status:503,json:{error:'Quiz fixture ends here.'}});}
    return route.fulfill({status:503,json:{error:'Unmatched test request'}});
  });
  await page.goto('/');const hasMedia=await page.evaluate(()=>typeof AudioContext==='function'&&typeof MediaRecorder==='function');test.skip(!hasMedia,'The Windows WebKit port has no capture/Web Audio APIs.');
  await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await expect(page.locator('.scene-npc')).toHaveClass(/speaking/);
  await expect(page.locator('.scene-npc')).not.toHaveClass(/speaking/);
  await page.getByRole('button',{name:'Mulai merekam',exact:true}).click();
  // No stop or send click: the speech pause completes the turn.
  await expect(page.getByText('Nggih. Rahajeng margi.',{exact:true})).toBeVisible({timeout:12000});
  await expect(page.locator('.scene-npc')).toHaveClass(/speaking/);expect(sent).toBe(1);expect(speech).toEqual(['opening','reply']);
  expect(await page.locator('.npc-mouth-layer').count()).toBe(0);
  expect(await page.locator('.scene-npc').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  await expect(page.locator('.scene-npc')).not.toHaveClass(/speaking/);expect(quiz).toBe(0);
  await expect(page.getByRole('button',{name:'Buka kuis',exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath('voice-finished.png'),fullPage:true});
  await page.getByRole('button',{name:'Buka kuis',exact:true}).click();await expect.poll(()=>quiz).toBe(1);
});
