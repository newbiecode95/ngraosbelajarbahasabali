import { test,expect } from '@playwright/test';

test('welcome explains the game, transitions into the village, and refresh stays in the app',async({page},info)=>{
  await page.route('**/api/**',r=>r.fulfill({json:{player:null,aiReady:true}}));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Dari Tamiu jadi Nyama.'})).toBeVisible();
  await expect(page.getByText('Belajar Basa Bali lewat percakapan.',{exact:false})).toBeVisible();
  await expect(page.locator('.welcome__guide li')).toHaveCount(3);
  const image=page.locator('.welcome__picture img');await expect(image).toBeVisible();expect(await image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await expect(page.getByRole('region',{name:'Peta interaktif Desa Kenderan'})).toHaveCount(0);
  await page.screenshot({path:info.outputPath('welcome.png'),fullPage:true});
  await page.getByRole('button',{name:'Mulai',exact:true}).click();
  await expect(page.locator('.welcome')).toHaveClass(/welcome--entering/);
  await expect(page.getByRole('button',{name:'Masuk ke desa…',exact:true})).toBeDisabled();
  await expect(page.locator('.welcome__entry-status')).toBeVisible();
  await expect(page).toHaveURL(/\/desa$/);
  await expect(page.getByRole('heading',{name:/^(Ayo latihan\s*Basa Bali\.|Tamiu)$/}).filter({visible:true}).first()).toBeVisible();
  await page.goBack();await expect(page.getByRole('heading',{name:'Dari Tamiu jadi Nyama.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Mulai',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Mulai',exact:true}).click();await expect(page).toHaveURL(/\/desa$/);
  await page.reload();await expect(page.getByRole('heading',{name:/^(Ayo latihan\s*Basa Bali\.|Tamiu)$/}).filter({visible:true}).first()).toBeVisible();
});

test('welcome supports English, keyboard entry and reduced motion',async({page})=>{
  await page.route('**/api/**',r=>r.fulfill({json:{player:null,aiReady:true}}));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.getByRole('heading',{name:'How to play',exact:true})).toBeVisible();
  expect(await page.locator('.welcome__picture').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
  await page.getByRole('button',{name:'Begin',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/desa$/);
  await expect(page.getByRole('heading',{name:/^(Let’s practise\s*Balinese\.|Tamiu)$/}).filter({visible:true}).first()).toBeVisible();
});

test('welcome fits small screens without horizontal overflow',async({page},info)=>{
  test.skip(info.project.name!=='desktop-chromium','Explicit viewport matrix runs once.');
  for(const width of [320,390,760,1024,1440]){
    await page.setViewportSize({width,height:844});await page.goto('/');
    await expect(page.getByRole('button',{name:'Mulai',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    const button=await page.getByRole('button',{name:'Mulai',exact:true}).boundingBox();expect(button!.y+button!.height).toBeLessThan(844);
  }
});
