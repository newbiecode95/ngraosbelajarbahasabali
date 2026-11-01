"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LockKeyhole, MapPin, Sparkles } from 'lucide-react';
import { lessons } from '@/content/lessons';
import type { LevelId, Locale, Player, SessionResult } from '@/lib/types';
import { Stars } from './ui';

export const villageStops:Record<LevelId,[number,number]>={warung:[220,312],kos:[790,269],pasar:[480,144],boss:[400,488]};
export type VillageVisit={id:string;from?:LevelId;to:LevelId;result?:SessionResult};
function routeFor(visit:VillageVisit){
  if(!visit.from)return 'M 400 610 C 400 510 315 460 270 410 S 220 355 220 312';
  if(visit.from==='warung'&&visit.to==='kos')return 'M 220 312 C 260 400 365 430 465 400 S 555 370 590 325 S 700 320 790 269';
  if(visit.from==='kos'&&visit.to==='pasar')return 'M 790 269 C 735 310 680 270 625 225 S 555 175 480 144';
  if(visit.from==='pasar'&&visit.to==='boss')return 'M 480 144 C 580 180 610 235 575 300 S 495 405 400 488';
  const start=villageStops[visit.from],end=villageStops[visit.to];return `M ${start.join(' ')} Q 500 390 ${end.join(' ')}`;
}
export function VillageTravel({visit,player,locale,reduced,onStart,onDismiss}:{visit:VillageVisit;player:Player;locale:Locale;reduced:boolean;onStart:(level:LevelId)=>void;onDismiss:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),avatar=useRef<SVGGElement>(null),trail=useRef<SVGPathElement>(null),title=useRef<HTMLHeadingElement>(null);
  const [arrived,setArrived]=useState(false);
  const lesson=lessons.find(l=>l.id===visit.to)!,last=visit.from==='boss',isNew=Boolean(visit.result?.unlockedLevel);
  const t=(id:string,en:string)=>locale==='id'?id:en;
  useEffect(()=>{
    const modal=dialog.current,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';modal?.showModal();title.current?.focus({preventScroll:true});
    return ()=>{modal?.close();document.body.style.overflow=overflow;};
  },[]);
  useEffect(()=>{
    const path=trail.current,dot=avatar.current;if(!path||!dot)return;
    const quiet=reduced||window.matchMedia('(prefers-reduced-motion: reduce)').matches||visit.from===visit.to;
    const length=path.getTotalLength(),began=performance.now();let frame=0;
    const move=(now:number)=>{
      const fraction=quiet?1:Math.min(1,(now-began)/1800),progress=fraction*fraction*(3-2*fraction);
      const point=path.getPointAtLength(length*progress);dot.setAttribute('transform',`translate(${point.x} ${point.y})`);
      if(fraction<1)frame=requestAnimationFrame(move);else setArrived(true);
    };
    frame=requestAnimationFrame(move);return ()=>cancelAnimationFrame(frame);
  },[visit,reduced]);
  const start=visit.from?villageStops[visit.from]:[400,610];
  return <dialog ref={dialog} className={`village-travel ${reduced?'village-travel--quiet':''}`} aria-labelledby="village-travel-title" onCancel={e=>{e.preventDefault();onDismiss();}}>
    <div className="village-travel__paper">
      <header>
        <p className="eyebrow">DESA KENDERAN</p>
        <h1 ref={title} id="village-travel-title" tabIndex={-1}>{visit.result?t(last?'Babak 1 selesai!':`Level ${lessons.find(l=>l.id===visit.from)!.number} selesai!`,last?'Chapter 1 complete!':`Level ${lessons.find(l=>l.id===visit.from)!.number} complete!`):t(`Rahajeng rauh, ${player.name}!`,`Welcome, ${player.name}!`)}</h1>
        <p>{visit.result?t(last?'Empat tempat, banyak cerita. Kamu sudah jadi bagian dari desa.':isNew?`Level ${lesson.number} terbuka. Ayo mampir ke ${lesson.title}.`:`Ayo kembali ke ${lesson.title}.`,last?'Four places, plenty of stories. You are part of the village now.':isNew?`Level ${lesson.number} is open. Let’s visit ${lesson.title}.`:`Let’s return to ${lesson.title}.`):visit.to==='warung'?t('Perjalananmu dimulai di warung Men Sari.','Your journey begins at Men Sari’s warung.'):t(`Lanjutkan perjalananmu ke ${lesson.title}.`,`Continue your journey to ${lesson.title}.`)}</p>
      </header>
      {visit.result?<div className="village-travel__reward"><Stars count={visit.result.stars} size={22}/><span><Sparkles size={16}/> +{visit.result.xp} XP</span><span>{visit.result.quizScore}/{visit.result.quizTotal} {t('kuis','quiz')}</span></div>:null}
      <div className={`village-travel__scene ${arrived?'has-arrived':''}`} data-destination={visit.to}>
        <svg viewBox="0 0 1000 625" role="img" aria-label={t(`Peta desa. Kamu menuju ${lesson.title}.`,`Village map. You are heading to ${lesson.title}.`)}>
          <image href="/images/desa-bali.webp" width="1000" height="625"/>
          <path className="village-travel__route-back" d={routeFor(visit)}/>
          <path ref={trail} className="village-travel__route" d={routeFor(visit)}/>
          {lessons.map((stop,index)=>{
            const open=index===0||Boolean(player.stars[lessons[index-1].id]);
            const locked=!open||(stop.id===visit.to&&isNew&&!arrived),point=villageStops[stop.id];
            return <g key={stop.id} transform={`translate(${point[0]} ${point[1]})`} className={`village-travel__stop ${locked?'is-locked':''} ${stop.id===visit.to?'is-target':''}`} data-level={stop.id} data-state={locked?'locked':'open'}>
              <circle r="28"/>{locked?<LockKeyhole x={-14} y={-14} width={28} height={28}/>:<text y="8" textAnchor="middle">{stop.number}</text>}
              <text className="village-travel__label" y={stop.id==='pasar'?-42:53} textAnchor="middle">{stop.title}</text>
            </g>;
          })}
          <g ref={avatar} className="village-travel__avatar" transform={`translate(${start[0]} ${start[1]})`} data-player-marker>
            <path d="M -10 -16 L 0 4 L 10 -16"/><circle cy="-36" r="27"/><text y="-29" textAnchor="middle">{player.name.slice(0,1).toLocaleUpperCase(locale)}</text><text className="village-travel__you" y="-77" textAnchor="middle">{t('KAMU','YOU')}</text>
          </g>
        </svg>
      </div>
      <div className="village-travel__destination" role="status" aria-live="polite">
        {arrived?<Check size={22}/>:<MapPin size={22}/>}
        <div><small>{arrived?t('Kamu di sini','You are here'):t('Menuju','On your way to')}</small><strong>{lesson.title}</strong></div>
        <span>Level {lesson.number}</span>
      </div>
      <footer>
        <button className="btn primary full" data-music-action="game" disabled={!arrived} onClick={()=>last?onDismiss():onStart(visit.to)}>{last?t('Kembali ke desa','Back to village'):t('Mulai ngobrol','Start talking')}<ArrowRight size={18}/></button>
        {!last?<button className="text-link" onClick={onDismiss}>{t('Jelajahi desa dulu','Explore the village first')}</button>:null}
      </footer>
    </div>
  </dialog>;
}
