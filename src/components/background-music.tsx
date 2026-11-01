"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BackgroundMusic } from '@/lib/background-music';

const MusicContext = createContext({ muted:false, setMuted:(_muted:boolean)=>{}, setGameActive:(_active:boolean)=>{} });
export const useBackgroundMusic = () => useContext(MusicContext);

export function BackgroundMusicProvider({children}:{children:ReactNode}) {
  const audio = useRef<HTMLAudioElement>(null), player = useRef<BackgroundMusic | null>(null);
  const inGame = useRef(false);
  const [muted,setMutedState] = useState(false);
  const setGameActive = useCallback((active:boolean) => {
    inGame.current = active;
    player.current?.configure({inGame:active});
  },[]);
  const setMuted = useCallback((value:boolean) => {
    setMutedState(value);
    player.current?.configure({muted:value});
    try {
      const stored = JSON.parse(localStorage.getItem('ngraos-preferences') || '{}');
      localStorage.setItem('ngraos-preferences',JSON.stringify({...stored,muted:value}));
    } catch {}
  },[]);
  useEffect(() => {
    if (!audio.current) return;
    let preference = false;
    try { preference = Boolean(JSON.parse(localStorage.getItem('ngraos-preferences') || '{}').muted); } catch {}
    setMutedState(preference);
    const music = new BackgroundMusic(audio.current);
    player.current = music;
    music.configure({muted:preference,inGame:inGame.current,hidden:document.hidden});
    const interact = (event:Event) => {
      const target = event.target instanceof Element ? event.target : null;
      // The first gesture may be to mute or start a lesson: don't fetch music
      // just to stop it again. These actions configure the player themselves.
      music.interact(Boolean(target?.closest('[data-music-action]')));
    };
    const visibility = () => music.configure({hidden:document.hidden});
    document.addEventListener('pointerdown',interact,{passive:true});
    document.addEventListener('keydown',interact);
    document.addEventListener('visibilitychange',visibility);
    return () => {
      document.removeEventListener('pointerdown',interact);
      document.removeEventListener('keydown',interact);
      document.removeEventListener('visibilitychange',visibility);
      music.dispose();
      player.current = null;
    };
  },[]);
  return <MusicContext.Provider value={{muted,setMuted,setGameActive}}>
    {children}
    <audio ref={audio} data-background-music="village" preload="none" loop aria-hidden="true" />
  </MusicContext.Provider>;
}

export function useMusicScene(inGame:boolean) {
  const {setGameActive} = useBackgroundMusic();
  useLayoutEffect(() => {
    setGameActive(inGame);
  },[inGame,setGameActive]);
  // Release only on unmount: scene-update cleanup would briefly start a song
  // while entering a lesson, causing an unnecessary media download.
  useLayoutEffect(() => () => setGameActive(false),[setGameActive]);
}
