"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, RequestError } from "@/lib/client-api";
import { createVoiceActivity } from "@/lib/voice-activity";
import type { LevelId } from "@/lib/types";
export function useRecorder(
  levelId: LevelId,
  onTranscript: (raw: string, normalized: string) => void,
  autoStop = false,
) {
  const [recording, setRecording] = useState(false),
    [transcribing, setTranscribing] = useState(false),
    [error, setError] = useState(""),
    [failures, setFailures] = useState(0),
    [seconds, setSeconds] = useState(0);
  const [automaticStop,setAutomaticStop]=useState(false);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const capture = useRef<AudioContext | null>(null),
    activityTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    pending = useRef(false),
    request = useRef<AbortController | null>(null);
  const endAnalysis = () => {
    if (activityTimer.current) clearInterval(activityTimer.current);
    activityTimer.current = null;
    void capture.current?.close().catch(() => {});
    capture.current = null;
  };
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      endAnalysis();
      request.current?.abort();
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    };
  }, []);
  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);
  async function start() {
    if (pending.current || recording || transcribing) return;
    pending.current = true;
    setError("");
    setAutomaticStop(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Mikrofon memerlukan HTTPS dan browser yang mendukung. Gunakan mode ketik.",
      );
      pending.current = false;
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.current = media;
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        endAnalysis();
        media.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        if (!alive.current) return;
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunks, { type: rec.mimeType });
          if (blob.size < 300)
            throw new Error("Rekaman terlalu pendek. Silakan coba lagi.");
          const data = new FormData();
          data.append(
            "audio",
            blob,
            rec.mimeType.includes("mp4") ? "voice.m4a" : "voice.webm",
          );
          data.append("levelId", levelId);
          const result = await api<{
            rawTranscript: string;
            normalizedTranscript: string;
          }>("/api/transcribe", {
            method: "POST",
            body: data,
            signal: (request.current = new AbortController()).signal,
          });
          if (alive.current) {
            callback.current(result.rawTranscript, result.normalizedTranscript);
            setFailures(0);
          }
        } catch (e) {
          if (alive.current) {
            setError(e instanceof Error ? e.message : "Suara belum terbaca.");
            setFailures((n) => n + 1);
          }
        } finally {
          pending.current = false;
          if (alive.current) setTranscribing(false);
        }
      };
      if (autoStop)
        try {
          const ac = new AudioContext();
          capture.current = ac;
          await ac.resume();
          const analyser = ac.createAnalyser();
          analyser.fftSize = 1024;
          ac.createMediaStreamSource(media).connect(analyser);
          setAutomaticStop(true);
          const data = new Float32Array(analyser.fftSize),
            activity = createVoiceActivity(),
            began = performance.now();
          activityTimer.current = setInterval(() => {
            analyser.getFloatTimeDomainData(data);
            const state = activity(
              Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length),
              performance.now() - began,
            );
            if (state === "finished") stop();
            if (state === "silent") {
              rec.onstop = () => {
                media.getTracks().forEach((t) => t.stop());
                endAnalysis();
                if (timer.current) clearInterval(timer.current);
                pending.current = false;
                setRecording(false);
                setError(
                  "Belum terdengar suara. Tekan mikrofon untuk mencoba lagi.",
                );
              };
              stop();
            }
          }, 50);
        } catch {
          /* Manual stop remains available on browsers without Web Audio. */
        }
      rec.start();
      setSeconds(0);
      setRecording(true);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 30) stop();
      }, 1000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      endAnalysis();
      pending.current = false;
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Izin mikrofon belum diberikan. Izinkan di browser atau gunakan mode ketik."
          : e instanceof Error
            ? e.message
            : "Mikrofon tidak tersedia.",
      );
      setFailures((n) => n + 1);
    }
  }
  return {
    recording,
    transcribing,
    error,
    failures,
    seconds,
    automaticStop,
    start,
    stop,
    clearError: () => setError(""),
  };
}
let playbackContext: AudioContext | null = null;
export function primeSpeechAudio() {
  try {
    if (!playbackContext || playbackContext.state === "closed")
      playbackContext = new AudioContext();
    void playbackContext.resume().catch(() => {});
  } catch {}
}
export function useSpeech(muted: boolean) {
  const [speaking, setSpeaking] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    frame = useRef<number>(0),
    audioContext = useRef<AudioContext | null>(null),
    source = useRef<AudioBufferSourceNode | null>(null),
    avatarRef = useRef<HTMLDivElement | null>(null);
  const stop = useCallback(() => {
    controller.current?.abort();
    if (source.current) {
      source.current.onended = null;
      try {
        source.current.stop();
      } catch {}
      source.current.disconnect();
      source.current = null;
    }
    if (frame.current) cancelAnimationFrame(frame.current);
    setSpeaking(false);
    setLoading(false);
    avatarRef.current?.style.setProperty("--voice-level", "0");
  }, []);
  const unlock = useCallback(() => {
    try {
      primeSpeechAudio();
      audioContext.current = playbackContext;
    } catch {}
  }, []);
  useEffect(() => {
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      stop();
      // Keep the gesture-unlocked context available to the next lesson.
      audioContext.current = null;
    };
  }, [stop, unlock]);
  useEffect(() => {
    if (muted) stop();
  }, [muted, stop]);
  async function play(payload: Record<string, string>) {
    stop();
    if (muted) return;
    unlock();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new RequestError(
          err.error ||
            "Audio belum tersedia. Percakapan tetap bisa dilanjutkan.",
        );
      }
      const bytes = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      const ac = audioContext.current;
      if (!ac) throw new Error("Audio tidak tersedia di browser ini.");
      if (ac.state !== "running") {
        await ac.resume();
        if ((ac.state as AudioContextState) !== "running")
          throw new Error("Tekan Dengarkan untuk mengaktifkan audio.");
      }
      const buffer = await ac.decodeAudioData(bytes);
      if (abort.signal.aborted) return;
      const player = ac.createBufferSource(),
        analyser = ac.createAnalyser();
      source.current = player;
      player.buffer = buffer;
      analyser.fftSize = 256;
      player.connect(analyser);
      analyser.connect(ac.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const volume = data.reduce((s, x) => s + x, 0) / data.length / 128;
        avatarRef.current?.style.setProperty(
          "--voice-level",
          String(Math.min(1, volume * 2)),
        );
        frame.current = requestAnimationFrame(tick);
      };
      player.onended = () => {
        analyser.disconnect();
        stop();
      };
      player.start();
      setSpeaking(true);
      tick();
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Audio belum tersedia.");
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  return { speaking, loading, error, play, stop, avatarRef };
}
