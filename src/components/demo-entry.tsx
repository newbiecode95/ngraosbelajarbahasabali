"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Flower2 } from 'lucide-react';
import type { Locale, Player } from '@/lib/types';
import { api, json } from '@/lib/client-api';
import { Brand, Spinner } from './ui';
import { useEntryJourney } from './entry-journey';

export function DemoEntry({locale,initialName='',notice,onReady}:{locale:Locale;initialName?:string;notice?:string;onReady:(player:Player)=>void}) {
  const [name,setName]=useState(initialName),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null),sending=useRef(false);
  const {isTraveling}=useEntryJourney();
  const t=(id:string,en:string)=>locale==='id'?id:en;
  useEffect(()=>{if(!isTraveling)input.current?.focus({preventScroll:true});},[isTraveling]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!name.trim()||sending.current)return;
    sending.current=true;setBusy(true);setError('');
    try{
      const result=await api<{player:Player}>('/api/demo',json({name:name.trim(),locale}));
      if(!result.player?.isDemo||result.player.needsName)throw new Error(t('Nama belum tersimpan. Coba lagi.','Your name has not been saved. Please retry.'));
      onReady(result.player);
    }catch(e){setError(e instanceof Error?e.message:t('Belum bisa masuk. Coba lagi.','Unable to enter. Please retry.'));}
    finally{sending.current=false;setBusy(false);}
  }
  return <main className="demo-entry" id="main-content" tabIndex={-1}>
    <Brand />
    <section className="demo-entry__card" aria-labelledby="demo-name-title">
      <span className="demo-entry__flower" aria-hidden="true"><Flower2 size={38}/></span>
      <p className="eyebrow">{t('RAHAJENG RAUH','WELCOME TO KENDERAN')}</p>
      <h1 id="demo-name-title">{t('Panggil kamu siapa?','What should we call you?')}</h1>
      <p>{t('Biar warga desa kenal kamu.','Let the neighbours get to know you.')}</p>
      <form onSubmit={submit}>
        <label htmlFor="demo-name">{t('Nama panggilan','Your name')}</label>
        <input ref={input} id="demo-name" data-entry-focus autoComplete="given-name" value={name} maxLength={60} required disabled={busy} placeholder={t('Contoh: Ayu','For example: Ayu')} onChange={e=>setName(e.target.value)}/>
        {error||notice?<p role="alert" className="inline-error">{error||notice}</p>:null}
        <button className="btn primary full" disabled={busy||!name.trim()}>{busy?<Spinner/>:t('Masuk desa','Enter the village')}<ArrowRight size={18}/></button>
      </form>
      <p className="demo-entry__note">{t('Profil demo · Progres tersimpan di browser ini.','Demo profile · Your progress stays in this browser.')}</p>
    </section>
    <span className="demo-entry__village">Desa Kenderan, Bali</span>
  </main>;
}
