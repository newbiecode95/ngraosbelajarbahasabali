"use client";
import { useEffect, useRef } from "react";

// Procedural stream/wind bed: no recordings, downloads, or microphone input.
// The AudioContext starts only after a deliberate interaction with the page.
export function useAmbience(muted: boolean, conversation: boolean) {
  const settings = useRef({ muted, conversation });
  const control = useRef<(() => void) | null>(null);
  settings.current = { muted, conversation };
  useEffect(() => {
    control.current?.();
  }, [muted, conversation]);
  useEffect(() => {
    let context: AudioContext | null = null,
      gain: GainNode | null = null,
      source: AudioBufferSourceNode | null = null;
    const update = () => {
      if (!context || !gain) return;
      const volume =
        settings.current.muted || document.hidden
          ? 0
          : settings.current.conversation
            ? 0.003
            : 0.013;
      gain.gain.setTargetAtTime(volume, context.currentTime, 0.35);
    };
    control.current = update;
    const begin = () => {
      if (settings.current.muted) return;
      if (context) {
        void context.resume().catch(() => {});
        return;
      }
      try {
        context = new AudioContext();
        const buffer = context.createBuffer(
            1,
            context.sampleRate * 5,
            context.sampleRate,
          ),
          samples = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = (previous + 0.025 * (Math.random() * 2 - 1)) / 1.025;
          samples[i] = previous * 4;
        }
        source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1800;
        gain = context.createGain();
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.start();
        void context.resume().catch(() => {});
        update();
      } catch {
        /* Ambience is optional; voice and text remain usable. */
      }
    };
    document.addEventListener("pointerdown", begin);
    document.addEventListener("keydown", begin);
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("pointerdown", begin);
      document.removeEventListener("keydown", begin);
      document.removeEventListener("visibilitychange", update);
      control.current = null;
      source?.stop();
      void context?.close().catch(() => {});
    };
  }, []);
}
