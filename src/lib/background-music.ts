export const MUSIC_VOLUME = 0.45;
export const MUSIC_FADE_IN_MS = 1400;
export const MUSIC_FADE_OUT_MS = 180;

/** One streaming player, retained by the root layout across client navigation. */
export class BackgroundMusic {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private frame = 0;
  private pauseTimer: ReturnType<typeof setTimeout> | undefined;
  private starting = false;
  private unlocked = false;
  private disposed = false;
  private fallback = false;
  private settings = { muted: true, inGame: false, hidden: false };

  constructor(private audio: HTMLAudioElement) {
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = 0;
    audio.addEventListener('error', this.onError);
  }
  configure(settings: Partial<typeof this.settings>) {
    this.settings = { ...this.settings, ...settings };
    this.update();
  }
  private allowed() {
    return !this.disposed && !this.settings.muted && !this.settings.inGame && !this.settings.hidden;
  }
  /** Must run inside an actual tap/key gesture; never downloads on page load. */
  interact(skipStart = false) {
    this.unlocked = true;
    if (!skipStart) this.update();
  }
  private cancelFade() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    clearTimeout(this.pauseTimer);
    this.pauseTimer = undefined;
  }
  private fade(target: number, ms: number) {
    this.cancelFade();
    if (this.context && this.gain) {
      const now = this.context.currentTime, parameter = this.gain.gain;
      const current = parameter.value;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(current, now);
      parameter.linearRampToValueAtTime(target, now + ms / 1000);
    } else {
      const from = this.audio.volume, start = performance.now();
      const step = (now: number) => {
        const progress = ms ? Math.min(1, (now - start) / ms) : 1;
        this.audio.volume = Math.max(0, Math.min(1, from + (target - from) * progress));
        if (progress < 1) this.frame = requestAnimationFrame(step);
      };
      if (ms) this.frame = requestAnimationFrame(step);
      else this.audio.volume = target;
    }
  }
  private prepare() {
    if (!this.audio.getAttribute('src')) {
      this.audio.src = this.audio.canPlayType('audio/ogg; codecs="opus"')
        ? '/audio/village-bali-v1.ogg' : '/audio/village-bali-v1.mp3';
    }
    // GainNode fades also work on mobile browsers that ignore element.volume.
    if (!this.context && typeof AudioContext === 'function') {
      try {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = 0;
        this.source = this.context.createMediaElementSource(this.audio);
        this.source.connect(this.gain);
        this.gain.connect(this.context.destination);
        this.audio.volume = 1;
      } catch {
        this.source?.disconnect();
        this.gain?.disconnect();
        void this.context?.close().catch(() => {});
        this.context = null;
        this.gain = null;
      }
    }
  }
  private update() {
    if (this.disposed) return;
    if (!this.allowed()) {
      const ms = this.settings.hidden ? 0 : MUSIC_FADE_OUT_MS;
      this.fade(0, ms);
      if (!ms) this.audio.pause();
      else this.pauseTimer = setTimeout(() => {
        if (!this.allowed()) this.audio.pause();
      }, ms + 30);
      return;
    }
    if (!this.unlocked) return;
    clearTimeout(this.pauseTimer);
    if (!this.audio.paused && !this.starting) {
      void this.context?.resume().catch(() => {});
      this.fade(MUSIC_VOLUME, MUSIC_FADE_IN_MS);
      return;
    }
    if (this.starting) return;
    this.prepare();
    void this.context?.resume().catch(() => {});
    this.starting = true;
    // play() remains in the gesture call stack; awaiting resume first would
    // lose activation on stricter mobile autoplay implementations.
    void this.audio.play().then(() => {
      this.starting = false;
      if (this.allowed()) this.fade(MUSIC_VOLUME, MUSIC_FADE_IN_MS);
      else { this.fade(0, 0); this.audio.pause(); }
    }).catch(() => {
      this.starting = false;
      // Optional music must never block navigation, capture or NPC playback.
      // A subsequent genuine gesture can retry an autoplay rejection.
    });
  }
  private onError = () => {
    if (this.disposed || this.fallback || !this.audio.src.endsWith('.ogg')) return;
    this.fallback = true;
    this.starting = false;
    this.audio.src = '/audio/village-bali-v1.mp3';
    this.update();
  };
  dispose() {
    this.disposed = true;
    this.cancelFade();
    this.audio.pause();
    this.audio.removeEventListener('error', this.onError);
    this.audio.removeAttribute('src');
    this.audio.load();
    this.source?.disconnect();
    this.gain?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
