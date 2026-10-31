// End a turn after speech followed by a pause. Short hesitations do not end it.
export function createVoiceActivity() {
  let speechMs = 0,
    lastSpeech = 0,
    lastTick = 0;
  return (
    rms: number,
    elapsedMs: number,
  ): "listening" | "finished" | "silent" => {
    const delta = lastTick ? Math.min(100, elapsedMs - lastTick) : 50;
    lastTick = elapsedMs;
    if (rms > 0.015) {
      speechMs += delta;
      lastSpeech = elapsedMs;
    }
    if (speechMs >= 250 && elapsedMs - lastSpeech >= 1500) return "finished";
    if (speechMs < 250 && elapsedMs >= 9000) return "silent";
    return "listening";
  };
}
