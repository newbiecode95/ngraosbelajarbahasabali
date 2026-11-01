import { test, expect } from '@playwright/test';
import { lessons } from '../../src/content/lessons';
import type { GameSession, Player } from '../../src/lib/types';

for(const levelId of ['kos','pasar','boss'] as const)test(`${levelId}: saved quiz continues to the correct next destination`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('ngraos-preferences',JSON.stringify({muted:true,reduced:true,locale:'id'})));
  const lesson=lessons.find(item=>item.id===levelId)!;const levelIndex=lessons.indexOf(lesson),next=lessons[levelIndex+1];
  let player:Player={id:'continuation-test',name:'Ayu',locale:'id',xp:200,streak:1,isDemo:true,isAdmin:false,stars:Object.fromEntries(lessons.slice(0,levelIndex).map(item=>[item.id,3])),albums:lessons.slice(0,levelIndex).map(item=>item.id),activeSessionId:'afef6c9a-1c24-4d89-9e38-83c90440e5f6'};
  const quiz=Array.from({length:5},(_,i)=>({id:`q${i}`,type:'choice' as const,prompt:{id:'Pilih jawaban.',en:'Choose an answer.'},options:['Suksma.','Tiang pamit.'],sourceId:'phrase:warung-07',reinforcement:true}));
  let session:GameSession={id:player.activeSessionId!,levelId,status:'quiz',turns:[],completedObjectives:lesson.objectives.map(item=>item.id),hintsUsed:0,quiz,quizResponses:Object.fromEntries(quiz.map(q=>[q.id,{answer:'Suksma.',correct:true,expectedAnswer:'Suksma.'}]))};
  let target='';
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/player')return route.fulfill({json:{player,aiReady:true}});
    if(path.endsWith('/complete')){
      session={...session,status:'completed',result:{stars:3,xp:100,quizScore:5,quizTotal:5,newAlbum:true,...(next?{unlockedLevel:next.id}:{})}};
      player={...player,stars:{...player.stars,[levelId]:3},albums:[...player.albums,levelId],activeSessionId:undefined};return route.fulfill({json:{session,player}});
    }
    if(path==='/api/sessions'){
      target=route.request().postDataJSON().levelId;session={id:'473eac1f-04cd-43dd-86c5-d0fb027500e1',levelId:target as GameSession['levelId'],status:'active',turns:[],completedObjectives:[],hintsUsed:0};return route.fulfill({json:{session}});
    }
    return route.fulfill({json:{session}});
  });
  await page.goto('/desa');await page.getByRole('button',{name:'Lanjutkan',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Tepat!',exact:true})).toBeVisible();await page.getByRole('button',{name:'Lihat hasil',exact:true}).click();
  if(next){
    await page.getByRole('button',{name:next.id==='boss'?'Mulai tantangan akhir':`Lanjut ke ${next.title}`,exact:true}).click();
    await expect(page.getByRole('heading',{name:next.objectives[0].title.id,exact:true})).toBeVisible();expect(target).toBe(next.id);
    if(next.id==='boss')await expect(page.getByRole('button',{name:'Petunjuk',exact:true})).toHaveCount(0);
  }else{
    await expect(page.getByRole('heading',{name:'Babak 1 selesai!',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Kembali ke desa',exact:true}).click();
    if((page.viewportSize()?.width||0)<=760)await expect(page.getByRole('heading',{name:'Nyama',exact:true})).toBeVisible();
    expect(target).toBe('');
  }
});
