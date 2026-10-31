import { test, expect, type Page, type TestInfo } from '@playwright/test';
import type { GameSession, Player, Turn } from '../../src/lib/types';

const sessionId='12866ee3-0eb1-4ed4-b93f-1e4eaadf1101';
function initialPlayer():Player {return {id:'1330a859-cac0-4211-8ce6-f8f2bf442d7e',name:'Ayu',locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]};}
function initialSession():GameSession {return {id:sessionId,levelId:'warung',status:'active',turns:[],completedObjectives:[],hintsUsed:0};}

async function quietAudio(page:Page) {
  await page.addInitScript(()=>{
    localStorage.setItem('ngraos-preferences',JSON.stringify({muted:true,reduced:true,locale:'id'}));
  });
  // Blocking the app's provider-backed routes prevents server-side paid requests.
  // Routing openrouter.ai in the browser alone would not stop those requests.
  for(const path of ['**/api/speech','**/api/transcribe','**/api/sessions/*/turns','**/api/sessions/*/quiz']) {
    await page.route(path,route=>route.fulfill({status:503,json:{error:'AI disabled in this browser acceptance test.',code:'E2E_AI_BLOCKED',retryable:true}}));
  }
}
async function noOverflow(page:Page) {
  const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  expect(width.document).toBeLessThanOrEqual(width.viewport+1);
  expect(width.body).toBeLessThanOrEqual(width.viewport+1);
}
async function screenshot(page:Page,testInfo:TestInfo,name:string) {
  const path=testInfo.outputPath(`${name}.png`);
  await page.screenshot({path,fullPage:true});
  await testInfo.attach(name,{path,contentType:'image/png'});
}
async function mockApp(page:Page) {
  let player=initialPlayer();let session=initialSession();
  await page.route('**/api/player',async route=>{
    if(route.request().method()==='PATCH') player={...player,...route.request().postDataJSON()};
    await route.fulfill({json:{player,aiReady:true}});
  });
  await page.route('**/api/sessions',async route=>{
    player={...player,activeSessionId:session.id};
    await route.fulfill({status:201,json:{session}});
  });
  await page.route(`**/api/sessions/${sessionId}`,route=>route.fulfill({json:{session}}));
  return {getSession:()=>session,setSession:(value:GameSession)=>{session=value;},getPlayer:()=>player};
}

test('real demo API: welcome → map → lesson → persisted resume, without paid AI',async({page,context},testInfo)=>{
  await quietAudio(page);
  await context.setExtraHTTPHeaders({'x-forwarded-for':'playwright-'+crypto.randomUUID()});
  let ownsDemo=false;
  try {
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Ayo latihan Basa Bali.'})).toBeVisible();
    await expect(page.getByRole('region',{name:'Peta interaktif Desa Kenderan'})).toBeVisible();
    await noOverflow(page);
    await screenshot(page,testInfo,'welcome-map');
    await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('heading',{name:'Rahajeng rauh!'})).toBeVisible();
    await dialog.getByLabel('Nama panggilan').fill('Playwright Tamiu');
    const demoResponse=page.waitForResponse(response=>response.url().endsWith('/api/demo')&&response.request().method()==='POST');
    await dialog.getByRole('button',{name:'Mulai belajar'}).click();
    expect((await demoResponse).ok()).toBe(true);ownsDemo=true;
    const demoPlayer=(await (await context.request.get('/api/player')).json()).player as Player;
    expect(demoPlayer.name).toBe('Playwright Tamiu');expect(demoPlayer.locale).toBe('id');
    await expect(page.getByText('Mode demo • Progres terpisah dari akun pribadi')).toBeVisible();
    await expect(dialog).not.toBeVisible();
    const createdResponse=page.waitForResponse(response=>response.url().endsWith('/api/sessions')&&response.request().method()==='POST');
    await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
    const created=(await (await createdResponse).json()).session as GameSession;
    await expect(page.getByRole('heading',{name:'Warung Men Sari',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Ketik',exact:true}).click();
    await page.getByLabel('Apa yang ingin kamu katakan?').fill('Rahajeng semeng.');
    await expect(page.getByRole('button',{name:'Kirim ucapan'})).toBeEnabled();
    const hintResponse=page.waitForResponse(response=>response.url().endsWith(`/api/sessions/${created.id}/hint`));
    await page.getByRole('button',{name:'Petunjuk',exact:true}).click();
    expect((await hintResponse).ok()).toBe(true);
    await noOverflow(page);
    await screenshot(page,testInfo,'lesson-text-mode');
    await page.reload();
    await expect(page.getByRole('button',{name:'Lanjutkan',exact:true})).toBeVisible();
    const resumedResponse=page.waitForResponse(response=>response.url().endsWith(`/api/sessions/${created.id}`)&&response.request().method()==='GET');
    await page.getByRole('button',{name:'Lanjutkan',exact:true}).click();
    const resumed=(await (await resumedResponse).json()).session as GameSession;
    expect(resumed.id).toBe(created.id);expect(resumed.hintsUsed).toBe(1);expect(resumed.turns).toHaveLength(0);
    await expect(page.getByRole('heading',{name:'Warung Men Sari',exact:true})).toBeVisible();
    await noOverflow(page);
  } finally {
    // Delete only the fresh demo owned by this browser context, never an existing account.
    if(ownsDemo) expect((await context.request.delete('/api/player')).ok()).toBe(true);
  }
});

test('microphone denial falls back to typing and a failed turn can be retried safely',async({page},testInfo)=>{
  await quietAudio(page);
  const app=await mockApp(page);
  await page.addInitScript(()=>{
    const devices=navigator.mediaDevices||{};
    if(!navigator.mediaDevices)Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:devices});
    Object.defineProperty(devices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('Denied for acceptance test','NotAllowedError');}});
  });
  const submitted:{id:string;text:string}[]=[];
  await page.route(`**/api/sessions/${sessionId}/turns`,async route=>{
    const body=route.request().postDataJSON() as {id:string;text:string};submitted.push(body);
    if(submitted.length===1) {await route.fulfill({status:504,json:{error:'Karakter memerlukan waktu lebih lama. Coba lagi; progres Anda aman.',code:'AI_TIMEOUT',retryable:true}});return;}
    const turn:Turn={id:body.id,playerText:body.text,reply:'Rahajeng semeng.',translation:{id:'Selamat pagi.',en:'Good morning.'},corrections:[],objectiveIds:['warung:greet'],assessed:true,createdAt:new Date().toISOString()};
    app.setSession({...app.getSession(),turns:[turn],completedObjectives:['warung:greet']});
    await route.fulfill({json:{session:app.getSession(),turn}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
  await page.getByRole('button',{name:'Mulai merekam',exact:true}).click();
  await expect(page.locator('.composer [role="alert"]')).toContainText('Izin mikrofon belum diberikan');
  await page.getByRole('button',{name:'Mulai merekam',exact:true}).click();
  const input=page.getByLabel('Apa yang ingin kamu katakan?');
  await expect(input).toBeVisible();
  await input.fill('Rahajeng semeng.');
  await page.getByRole('button',{name:'Kirim ucapan'}).click();
  await expect(page.locator('.composer [role="alert"]')).toContainText('progres Anda aman');
  await expect(input).toHaveValue('Rahajeng semeng.');
  await page.getByRole('button',{name:'Kirim ucapan'}).click();
  await expect(page.locator('.player-message')).toContainText('Rahajeng semeng.');
  expect(submitted).toHaveLength(2);expect(submitted[0].id).toBe(submitted[1].id);
  await expect(input).toHaveValue('');
  await noOverflow(page);
  await screenshot(page,testInfo,'microphone-denial-recovered');
});

test('locked locations, English settings, reload and responsive navigation work',async({page},testInfo)=>{
  await quietAudio(page);await mockApp(page);
  await page.goto('/');
  await page.getByRole('button',{name:'Kos Bu Komang, terkunci',exact:true}).click();
  await expect(page.getByRole('button',{name:'Selesaikan lokasi sebelumnya',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Buka profil',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pengaturan'})).toBeVisible();
  await page.locator('.setting-row').filter({hasText:'Bahasa antarmuka'}).getByRole('button',{name:'ID',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Learning experience'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await noOverflow(page);
  await screenshot(page,testInfo,'english-settings');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Let’s practise Balinese.'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  const menu=page.getByRole('button',{name:'Buka menu',exact:true});
  if(await menu.isVisible())await menu.click();
  await page.getByRole('button',{name:'Village album',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Village album'})).toBeVisible();
  await noOverflow(page);
});
