import { test,expect } from '@playwright/test';
test('word order waits until every word is placed',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ngraos-preferences',JSON.stringify({muted:true,reduced:true,locale:'id'})));
  await page.route('**/api/**',route=>{
    if(new URL(route.request().url()).pathname==='/api/player')return route.fulfill({json:{player:{id:'layout-test',name:'Ayu',locale:'id',xp:0,streak:0,isDemo:true,isAdmin:false,stars:{},albums:[]},aiReady:true}});
    return route.fulfill({json:{session:{id:'36e84f02-3f1a-4a0d-8d2b-530ad29dc6a7',levelId:'warung',status:'quiz',turns:[],completedObjectives:['warung:greet','warung:thank','warung:farewell'],hintsUsed:0,quiz:[{id:'order-test',type:'order',prompt:{id:'Susun ucapan terima kasih banyak.',en:'Arrange the phrase for thank you very much.'},words:['pisan.','Suksma'],sourceId:'phrase:warung-07',reinforcement:true}]}}});
  });
  await page.goto('/desa');await page.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();const next=page.getByRole('button',{name:'Lihat hasil',exact:true});
  await expect(next).toBeDisabled();await page.getByRole('button',{name:'Suksma',exact:true}).click();await expect(next).toBeDisabled();await page.getByRole('button',{name:'pisan.',exact:true}).click();await expect(next).toBeEnabled();
});
test('map, navigation, sources, album and profile fit phone, tablet and desktop widths',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','This scenario explicitly visits six viewport sizes.');
  await page.route('**/api/**',r=>r.fulfill({json:{player:null,aiReady:true}}));
  for(const width of [320,390,760,768,1024,1440]){
    await page.setViewportSize({width,height:900});await page.goto('/desa');
    await expect(page.getByRole('heading',{name:'Ayo latihan Basa Bali.'})).toBeVisible();
    const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    expect(await overflow(),`map ${width}`).toBe(false);
    if(width<=760){await expect(page.locator('.sidebar')).toHaveAttribute('inert','');const card=await page.locator('.mission-panel').boundingBox();const map=await page.locator('.village-panel').boundingBox();expect(card!.y).toBeLessThan(map!.y);}
    for(const [name,heading] of [['Sumber belajar','Kamus & sumber belajar'],['Album Desa','Album Desa'],['Pengaturan','Pengaturan']]){
      if(width<=760)await page.getByRole('button',{name:'Buka menu',exact:true}).click();
      await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();expect(await overflow(),`${name} ${width}`).toBe(false);
    }
  }
});
