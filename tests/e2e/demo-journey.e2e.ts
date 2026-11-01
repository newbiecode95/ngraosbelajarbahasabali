import { test,expect,type Page } from '@playwright/test';
import type { GameSession,Player,QuizQuestion } from '../../src/lib/types';
const id='3088d8cb-8322-4530-821e-57015934aa52';
async function demoFixture(page:Page,options:{returning?:boolean;reduced?:boolean;failName?:boolean}={}){
  await page.addInitScript(reduced=>localStorage.setItem('ngraos-preferences',JSON.stringify({muted:true,reduced,locale:'id'})),Boolean(options.reduced));
  let player:Player|null=options.returning?{id:'demo-journey',name:'Tamiu',needsName:false,locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]}:null;
  let session:GameSession={id,levelId:'warung',status:'active',turns:[],completedObjectives:[],hintsUsed:0};
  let names=0,turns=0,completions=0;const starts:string[]=[];
  const questions:QuizQuestion[]=[
    {id:'q1',type:'choice',prompt:{id:'Pilih ucapan terima kasih.',en:'Choose the expression of thanks.'},options:['Suksma.','Nggih','nénten','sampun'],sourceId:'phrase:warung-07',reinforcement:true},
    {id:'q2',type:'order',prompt:{id:'Susun ucapan untuk berpamitan.',en:'Arrange a goodbye.'},words:['pamit.','Tiang'],sourceId:'phrase:warung-13',reinforcement:true},
    {id:'q3',type:'repeat',prompt:{id:'Ulangi kalimatnya.',en:'Repeat the phrase.'},target:'Suksma.',sourceId:'phrase:warung-07',reinforcement:true},
    {id:'q4',type:'choice',prompt:{id:'Pilih ucapan terima kasih.',en:'Choose the expression of thanks.'},options:['Suksma.','Nggih','nénten','sampun'],sourceId:'phrase:warung-07',reinforcement:true},
    {id:'q5',type:'repeat',prompt:{id:'Ulangi kalimatnya.',en:'Repeat the phrase.'},target:'Suksma.',sourceId:'phrase:warung-07',reinforcement:true},
  ];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/player')return route.fulfill({json:{player,aiReady:true,demoOnly:true}});
    if(path==='/api/demo'){
      names++;if(options.failName&&names===1)return route.fulfill({status:503,json:{error:'Nama belum tersimpan. Coba lagi.'}});
      const body=route.request().postDataJSON();player={id:'demo-journey',name:body.name,needsName:false,locale:body.locale,xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]};
      return route.fulfill({json:{player}});
    }
    if(path==='/api/sessions'){
      const levelId=route.request().postDataJSON().levelId;starts.push(levelId);
      session={id,levelId,status:'active',turns:[],completedObjectives:[],hintsUsed:0};player!.activeSessionId=id;return route.fulfill({json:{session}});
    }
    if(path===`/api/sessions/${id}`)return route.fulfill({json:{session}});
    if(path.endsWith('/turns')){
      const body=route.request().postDataJSON(),objective=['warung:greet','warung:thank','warung:farewell'][turns++];
      const turn={id:body.id,playerText:body.text,reply:'Nggih, suksma.',translation:{id:'Ya, terima kasih.',en:'Yes, thank you.'},corrections:[],objectiveIds:[objective],assessed:true,createdAt:new Date().toISOString()};
      session={...session,turns:[...session.turns,turn],completedObjectives:[...session.completedObjectives,objective]};return route.fulfill({json:{session,turn}});
    }
    if(path.endsWith('/quiz')){session={...session,status:'quiz',quiz:questions};return route.fulfill({json:{session}});}
    if(path.endsWith('/answer')){
      const body=route.request().postDataJSON();session={...session,quizResponses:{...session.quizResponses,[body.questionId]:{answer:body.answer,correct:true,expectedAnswer:body.answer}}};return route.fulfill({json:{session}});
    }
    if(path.endsWith('/complete')){
      completions++;expect(Object.keys(session.quizResponses||{})).toHaveLength(5);
      session={...session,status:'completed',result:{stars:3,xp:180,quizScore:5,quizTotal:5,newAlbum:true,unlockedLevel:'kos'}};
      player={...player!,xp:180,stars:{warung:3},albums:['warung'],activeSessionId:undefined};return route.fulfill({json:{session,player}});
    }
    return route.fulfill({status:503,json:{error:'Paid providers are blocked in demo journey fixtures.'}});
  });
  return {starts,get names(){return names;},get completions(){return completions;}};
}

test('map arrival → named demo → Level 1 → quiz → animated Level 2 unlock',async({page},info)=>{
  const fixture=await demoFixture(page);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');await page.getByRole('button',{name:'Mulai',exact:true}).click();
  await expect(page.locator('.entry-journey')).toBeVisible();expect(fixture.names).toBe(0);
  await expect(page.locator('.entry-journey')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Panggil kamu siapa?',exact:true})).toBeVisible();
  await expect(page.getByLabel('Nama panggilan')).toBeFocused();
  await expect(page.getByRole('button',{name:'Masuk desa',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Masuk',exact:true})).toHaveCount(0);await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);
  await page.getByLabel('Nama panggilan').fill('Ayu');await page.getByRole('button',{name:'Masuk desa',exact:true}).click();
  const travel=page.getByRole('dialog');await expect(travel).toBeVisible();expect(fixture.names).toBe(1);
  await expect(travel.getByRole('heading',{name:'Rahajeng rauh, Ayu!',exact:true})).toBeVisible();
  const marker=travel.locator('[data-player-marker]');const start=await marker.getAttribute('transform');
  await expect.poll(()=>marker.getAttribute('transform')).not.toBe(start);
  await expect(travel.locator('.village-travel__scene')).toHaveClass(/has-arrived/);
  await expect(marker).toHaveAttribute('transform','translate(220 312)');
  await expect(travel.locator('[data-level="kos"]')).toHaveAttribute('data-state','locked');
  await page.screenshot({path:info.outputPath('arrival-level-1.png'),fullPage:true});
  await travel.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();expect(fixture.starts).toEqual(['warung']);
  await page.getByRole('button',{name:'Ketik',exact:true}).click();
  for(const phrase of ['Rahajeng semeng.','Suksma.','Tiang pamit.']){
    await page.getByLabel('Apa yang ingin kamu katakan?').fill(phrase);await page.getByRole('button',{name:'Kirim ucapan',exact:true}).click();
    await expect(page.locator('.turn-group .player-message').getByText(phrase,{exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Buka kuis',exact:true}).click();
  for(let i=0;i<5;i++){
    if(i===0||i===3)await page.getByRole('button',{name:/^[A-D] Suksma\.$/}).click();
    else if(i===1){await page.locator('.word-bank').getByRole('button',{name:'Tiang',exact:true}).click();await page.locator('.word-bank').getByRole('button',{name:'pamit.',exact:true}).click();}
    else await page.getByLabel('Jawaban ulang-ucap').fill('Suksma.');
    await page.getByRole('button',{name:'Periksa jawaban',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Tepat!',exact:true})).toBeVisible();
    await page.getByRole('button',{name:i===4?'Lihat hasil':'Lanjutkan',exact:true}).click();
  }
  await expect(travel.getByRole('heading',{name:'Level 1 selesai!',exact:true})).toBeVisible();
  await expect(travel.locator('[data-level="kos"]')).toHaveAttribute('data-state','locked');
  const from=await marker.getAttribute('transform');await expect.poll(()=>marker.getAttribute('transform')).not.toBe(from);
  await expect(travel.locator('[data-level="kos"]')).toHaveAttribute('data-state','open');
  await expect(marker).toHaveAttribute('transform','translate(790 269)');
  await expect(travel.locator('[data-level="pasar"]')).toHaveAttribute('data-state','locked');expect(fixture.completions).toBe(1);
  await page.screenshot({path:info.outputPath('unlock-level-2.png'),fullPage:true});
  expect(fixture.starts).toEqual(['warung']);
  await travel.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();expect(fixture.starts).toEqual(['warung','kos']);
  await expect(page.getByRole('heading',{name:'Perkenalkan nama',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel('Nama panggilan')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Simpan dengan akun',exact:true})).toHaveCount(0);
});

test('name retries retain input; reduced motion settles at Level 1 without travel',async({page},info)=>{
  const fixture=await demoFixture(page,{reduced:true,failName:true});await page.goto('/desa');
  const name=page.getByLabel('Nama panggilan');await name.fill('Tamiu');await page.getByRole('button',{name:'Masuk desa',exact:true}).click();
  await expect(page.locator('.demo-entry [role="alert"]')).toContainText('Nama belum tersimpan');await expect(name).toHaveValue('Tamiu');
  await page.getByRole('button',{name:'Masuk desa',exact:true}).click();
  await expect(page.locator('.village-travel__scene')).toHaveClass(/has-arrived/);
  await expect(page.locator('[data-player-marker]')).toHaveAttribute('transform','translate(220 312)');expect(fixture.names).toBe(2);
  await page.getByRole('button',{name:'Jelajahi desa dulu',exact:true}).click();await page.reload();
  await expect(page.getByLabel('Nama panggilan')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('demo-dashboard.png'),fullPage:true});
});

test('an existing named Tamiu demo resumes without another name prompt',async({page})=>{
  await demoFixture(page,{returning:true,reduced:true});await page.goto('/desa');
  await expect(page.getByRole('button',{name:'Mulai ngobrol',exact:true})).toBeVisible();
  await expect(page.getByLabel('Nama panggilan')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Masuk',exact:true})).toHaveCount(0);
});

test('a 60-character name remains inside the village map at phone width',async({page})=>{
  await demoFixture(page,{reduced:true});await page.goto('/desa');
  await page.getByLabel('Nama panggilan').fill('A'.repeat(60));await page.getByRole('button',{name:'Masuk desa',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
