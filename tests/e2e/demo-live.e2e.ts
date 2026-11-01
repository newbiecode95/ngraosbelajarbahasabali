import 'dotenv/config';
import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { query,getPool } from '../../src/server/db';
import type { PrivateQuestion } from '../../src/server/game';
const escape=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
test('real demo: name → Level 1 mission and quiz → saved Level 2 map unlock',async({page},info)=>{
  test.skip(process.env.RUN_LIVE_DEMO!=='1','Explicit opt-in: creates its own disposable demo and uses real roleplay/quiz API calls.');
  test.setTimeout(150000);
  await page.addInitScript(()=>localStorage.setItem('ngraos-preferences',JSON.stringify({muted:true,reduced:false,locale:'id'})));
  await page.emulateMedia({reducedMotion:'no-preference'});
  let playerId:string|undefined,submittedName=false;
  const demoName=`Ayu uji ${randomUUID().slice(0,6)}`;
  try{
    const config=await (await page.request.get('/api/player')).json();expect(config.demoOnly).toBe(true);expect(config.player).toBeNull();
    const locked=await page.request.post('/api/auth/sign-in/email',{data:{email:'demo-test@ngraos.invalid',password:'NotARealPassword!'}});expect(locked.status()).toBe(403);expect((await locked.json()).code).toBe('DEMO_ONLY');
    await page.goto('/');await page.getByRole('button',{name:'Mulai',exact:true}).click();
    await expect(page.locator('.entry-journey')).toBeVisible();await expect(page.locator('.entry-journey')).toHaveCount(0);
    await expect(page.getByLabel('Nama panggilan')).toBeVisible();
    await page.screenshot({path:info.outputPath('live-demo-name.png'),fullPage:false});
    await page.getByLabel('Nama panggilan').fill(demoName);submittedName=true;
    const posted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/demo'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Masuk desa',exact:true}).click();
    const namedResponse=await posted;expect(namedResponse.ok()).toBe(true);const state=await namedResponse.json();playerId=state.player?.id;expect(state.player).toMatchObject({name:demoName,isDemo:true,needsName:false});
    const travel=page.getByRole('dialog');await expect(travel.getByRole('heading',{name:`Rahajeng rauh, ${demoName}!`,exact:true})).toBeVisible();
    await expect(travel.locator('[data-player-marker]')).toHaveAttribute('transform','translate(220 312)');
    await expect(travel.locator('[data-level="kos"]')).toHaveAttribute('data-state','locked');
    await page.screenshot({path:info.outputPath('live-demo-level-1.png'),fullPage:false});
    const premature=await page.request.post('/api/sessions',{data:{levelId:'kos'}});expect(premature.status()).toBe(403);
    await travel.getByRole('button',{name:'Mulai ngobrol',exact:true}).click();
    await page.getByRole('button',{name:'Ketik',exact:true}).click();
    for(const text of ['Rahajeng semeng.','Suksma.','Tiang pamit.']){
      await page.getByLabel('Apa yang ingin kamu katakan?').fill(text);await page.getByRole('button',{name:'Kirim ucapan',exact:true}).click();
      await expect(page.locator('.turn-group .player-message').getByText(text,{exact:true})).toBeVisible({timeout:60000});
    }
    await page.getByRole('button',{name:'Buka kuis',exact:true}).click();await expect(page.locator('.practice-quiz')).toBeVisible({timeout:60000});
    const row=(await query<{id:string;quiz:PrivateQuestion[]}>('SELECT id,quiz FROM game_sessions WHERE player_id=$1 AND level_id=$2 ORDER BY created_at DESC LIMIT 1',[playerId,'warung'])).rows[0];expect(row.quiz).toHaveLength(5);
    // Private keys are read only for this disposable test player; never exposed
    // by the public quiz API or written into screenshots/reports.
    for(let i=0;i<row.quiz.length;i++){
      const q=row.quiz[i];
      if(q.type==='choice')await page.locator('.practice-options').getByRole('button',{name:new RegExp(`^[A-D] ${escape(q.answer)}$`)}).click();
      else if(q.type==='order')for(const word of q.answer.trim().split(/\s+/))await page.locator('.word-bank button:enabled').filter({hasText:new RegExp(`^${escape(word)}$`)}).first().click();
      else await page.getByLabel('Jawaban ulang-ucap').fill(q.answer);
      await page.getByRole('button',{name:'Periksa jawaban',exact:true}).click();await expect(page.getByRole('heading',{name:'Tepat!',exact:true})).toBeVisible();
      await page.getByRole('button',{name:i===row.quiz.length-1?'Lihat hasil':'Lanjutkan',exact:true}).click();
    }
    await expect(travel.getByRole('heading',{name:'Level 1 selesai!',exact:true})).toBeVisible();
    await expect(travel.locator('[data-level="kos"]')).toHaveAttribute('data-state','open');
    await expect(travel.locator('[data-player-marker]')).toHaveAttribute('transform','translate(790 269)');
    await page.screenshot({path:info.outputPath('live-demo-level-2-unlocked.png'),fullPage:false});
    const saved=await (await page.request.get('/api/player')).json();expect(saved.player.stars.warung).toBeGreaterThanOrEqual(1);expect(saved.player.name).toBe(demoName);
    const retry=await page.request.post(`/api/sessions/${row.id}/complete`,{data:{answers:{}}});expect(retry.ok()).toBe(true);
    expect((await query('SELECT count(*)::int AS n FROM reward_events WHERE session_id=$1',[row.id])).rows[0].n).toBe(1);
    await travel.getByRole('button',{name:'Jelajahi desa dulu',exact:true}).click();await page.reload();
    await expect(page.getByLabel('Nama panggilan')).toHaveCount(0);await expect(page.getByRole('dialog')).toHaveCount(0);
    const next=await page.request.post('/api/sessions',{data:{levelId:'kos'}});expect(next.ok()).toBe(true);
    await info.attach('live-demo-result',{body:JSON.stringify({nameSaved:true,demoOnly:true,loginLocked:true,firstMissionCompleted:true,quizQuestions:row.quiz.length,level2Unlocked:true,refreshRetained:true,rewardEvents:1}),contentType:'application/json'});
  }finally{
    if(!playerId&&submittedName){try{playerId=(await query('SELECT id FROM players WHERE name=$1 AND auth_user_id IS NULL',[demoName])).rows[0]?.id;}catch{}}
    if(playerId)await query('DELETE FROM players WHERE id=$1 AND auth_user_id IS NULL',[playerId]);
    await getPool().end();
  }
});
