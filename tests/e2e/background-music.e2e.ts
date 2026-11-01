import { test,expect,type Page } from '@playwright/test';
import type { GameSession } from '../../src/lib/types';
const id='501474b4-0cb6-4c58-b77e-78bfb5d86824';

async function fixture(page:Page) {
  const session:GameSession={id,levelId:'warung',status:'active',turns:[],completedObjectives:['warung:greet','warung:thank','warung:farewell'],hintsUsed:0};
  await page.addInitScript(()=>{
    if(!localStorage.getItem('ngraos-preferences'))localStorage.setItem('ngraos-preferences',JSON.stringify({muted:false,reduced:true,locale:'id'}));
    if(typeof AudioContext!=='function')return;
    const create=AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource=function(media){
      const node=create.call(this,media),connect=node.connect.bind(node);
      node.connect=((destination:AudioNode)=>{
        Object.assign(window,{__musicGain:destination});
        return connect(destination);
      }) as typeof node.connect;
      return node;
    };
  });
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/player')return route.fulfill({json:{player:{id:'music-fixture',name:'Ayu',locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]},aiReady:true}});
    if(path==='/api/sessions'){
      // The music should already be stopping while the game request is pending.
      await new Promise(resolve=>setTimeout(resolve,400));
      return route.fulfill({json:{session}});
    }
    if(path.endsWith('/quiz'))return route.fulfill({json:{session:{...session,status:'quiz',quiz:[{id:'repeat',type:'repeat',prompt:{id:'Dengarkan lalu ulangi.',en:'Listen and repeat.'},target:'Suksma.',sourceId:'phrase:warung-07',reinforcement:true}]}}});
    return route.fulfill({status:503,json:{error:'Paid API calls blocked in music tests.'}});
  });
}
async function supported(page:Page) {
  const support=await page.evaluate(()=>({mp3:new Audio().canPlayType('audio/mpeg'),opus:new Audio().canPlayType('audio/ogg; codecs="opus"'),webAudio:typeof AudioContext==='function'}));
  test.skip(!support.mp3&&!support.opus,'This host engine has no playable music codecs; not a physical iOS playback pass.');
  return support;
}
const state=(page:Page)=>page.locator('audio[data-background-music]').evaluate((a:HTMLAudioElement)=>({paused:a.paused,time:a.currentTime,duration:a.duration,loop:a.loop,src:a.getAttribute('src'),volume:a.volume,error:a.error?.message,ready:a.readyState}));
async function playing(page:Page){await expect.poll(async()=>{const a=await state(page);return !a.paused&&a.time>.05;}).toBe(true);}

test('music loads after interaction, persists across navigation, pauses for game/quiz and fades back',async({page},info)=>{
  await fixture(page);const urls=new Set<string>();page.on('request',r=>{if(r.url().includes('/audio/'))urls.add(r.url());});
  await page.goto('/');const support=await supported(page);
  await expect(page.getByRole('button',{name:'Mulai',exact:true})).toBeEnabled();
  expect((await state(page)).src).toBeNull();expect(urls.size).toBe(0);
  await page.getByRole('heading',{name:'Dari Tamiu jadi Nyama.'}).click();
  await playing(page);
  const element=await page.locator('audio[data-background-music]').elementHandle();
  expect((await state(page)).loop).toBe(true);expect((await state(page)).duration).toBeGreaterThan(225);
  if(support.webAudio){
    const gain=()=>page.evaluate(()=>(window as typeof window & {__musicGain:GainNode}).__musicGain.gain.value);
    const early=await gain();expect(early).toBeLessThan(.45);
    await expect.poll(gain).toBeGreaterThan(.44);
    await info.attach('fade-in',{body:JSON.stringify({early,settled:await gain(),target:.45}),contentType:'application/json'});
  }
  const before=(await state(page)).time;
  await page.getByRole('button',{name:'Mulai',exact:true}).click();
  await expect(page).toHaveURL(/\/desa$/);
  await expect(page.getByRole('button',{name:'Mulai ngobrol',exact:true})).toBeEnabled();
  expect(await element!.evaluate(el=>el.isConnected)).toBe(true);expect((await state(page)).time).toBeGreaterThan(before);
  const started=Date.now();await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await expect.poll(async()=>(await state(page)).paused,{timeout:1500}).toBe(true);
  expect(Date.now()-started).toBeLessThan(1500);
  const paused=(await state(page)).time;
  await page.getByRole('button',{name:'Buka kuis',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Dengarkan lalu ulangi.',exact:true})).toBeVisible();
  expect((await state(page)).paused).toBe(true);expect((await state(page)).time).toBeCloseTo(paused,1);
  await page.getByRole('button',{name:'Kembali ke desa',exact:true}).click();
  await playing(page);expect((await state(page)).time).toBeGreaterThanOrEqual(paused);
  if(support.webAudio){
    const gain=()=>page.evaluate(()=>(window as typeof window & {__musicGain:GainNode}).__musicGain.gain.value);
    const early=await gain();expect(early).toBeLessThan(.45);
    await expect.poll(gain).toBeGreaterThan(.44);
    await info.attach('fade-back-to-village',{body:JSON.stringify({early,settled:await gain()}),contentType:'application/json'});
  }
  if((page.viewportSize()?.width||0)<=760)await page.getByRole('button',{name:'Buka menu',exact:true}).click();
  await page.getByRole('button',{name:'Album Desa',exact:true}).click();
  expect((await state(page)).paused).toBe(false);
  await page.goBack();await expect(page.getByRole('heading',{name:'Dari Tamiu jadi Nyama.'})).toBeVisible();
  expect(await element!.evaluate(el=>el.isConnected)).toBe(true);expect((await state(page)).paused).toBe(false);
  await page.getByRole('button',{name:'Matikan suara',exact:true}).click();
  await expect.poll(async()=>(await state(page)).paused).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ngraos-preferences')!).muted)).toBe(true);
  await page.reload();await expect(page.getByRole('button',{name:'Aktifkan suara',exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'Dari Tamiu jadi Nyama.'}).click();expect((await state(page)).src).toBeNull();
  await page.getByRole('button',{name:'Aktifkan suara',exact:true}).click();await playing(page);
  await page.screenshot({path:info.outputPath('welcome-music.png'),fullPage:true});
});

test('starting a game as the first gesture does not download music; returning starts it',async({page})=>{
  await fixture(page);
  await page.goto('/desa');await supported(page);
  await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await expect(page.getByRole('button',{name:'Buka kuis',exact:true})).toBeVisible();
  expect((await state(page)).src).toBeNull();
  await page.getByRole('button',{name:'Kembali ke desa',exact:true}).click();await playing(page);
});

test('failed Opus delivery falls back to the real MP3 and missing Web Audio keeps playback usable',async({page})=>{
  await fixture(page);
  await page.addInitScript(()=>Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined}));
  await page.route('**/audio/*.ogg',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/');const support=await supported(page);test.skip(!support.mp3,'This host has no MP3 decoder.');
  await expect(page.getByRole('button',{name:'Matikan suara',exact:true})).toBeEnabled();
  await page.getByRole('heading',{name:'Dari Tamiu jadi Nyama.'}).click();
  await playing(page);expect((await state(page)).src).toBe('/audio/village-bali-v1.mp3');
  await expect.poll(async()=>(await state(page)).volume).toBeGreaterThan(.44);
  await page.getByRole('button',{name:'Matikan suara',exact:true}).click();await expect.poll(async()=>(await state(page)).paused).toBe(true);
});

test('a failed game request restores music, and hiding the page pauses it',async({page})=>{
  await fixture(page);await page.route('**/api/sessions',route=>route.fulfill({status:503,json:{error:'Game temporarily unavailable.'}}));
  await page.goto('/desa');await supported(page);
  await page.getByRole('heading',{name:/^(Ayo latihan\s*Basa Bali\.|Tamiu)$/}).filter({visible:true}).click();await playing(page);
  await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await expect(page.getByText('Game temporarily unavailable.',{exact:true})).toBeVisible();await playing(page);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async()=>(await state(page)).paused).toBe(true);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
  });
  await playing(page);
});
