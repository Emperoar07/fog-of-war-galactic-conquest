"use client";

export type SoundCue =
  | "uiTap"
  | "modal"
  | "success"
  | "error"
  | "uplink"
  | "reveal"
  | "resolve"
  | "victory";

type CueStep = {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

const CUE_MAP: Record<SoundCue, CueStep[]> = {
  uiTap: [{ frequency: 720, duration: 0.05, type: "square", gain: 0.018 }],
  modal: [
    { frequency: 440, duration: 0.06, type: "triangle", gain: 0.018 },
    { frequency: 620, duration: 0.08, type: "triangle", gain: 0.016 },
  ],
  success: [
    { frequency: 540, duration: 0.06, type: "triangle", gain: 0.02 },
    { frequency: 810, duration: 0.08, type: "triangle", gain: 0.018 },
  ],
  error: [
    { frequency: 240, duration: 0.08, type: "sawtooth", gain: 0.02 },
    { frequency: 180, duration: 0.1, type: "sawtooth", gain: 0.018 },
  ],
  uplink: [
    { frequency: 410, duration: 0.04, type: "square", gain: 0.014 },
    { frequency: 530, duration: 0.05, type: "square", gain: 0.015 },
    { frequency: 690, duration: 0.06, type: "square", gain: 0.014 },
  ],
  reveal: [
    { frequency: 520, duration: 0.05, type: "triangle", gain: 0.016 },
    { frequency: 660, duration: 0.05, type: "triangle", gain: 0.016 },
    { frequency: 840, duration: 0.08, type: "sine", gain: 0.014 },
  ],
  resolve: [
    { frequency: 260, duration: 0.05, type: "square", gain: 0.018 },
    { frequency: 390, duration: 0.06, type: "square", gain: 0.018 },
    { frequency: 520, duration: 0.08, type: "triangle", gain: 0.016 },
  ],
  victory: [
    { frequency: 420, duration: 0.08, type: "triangle", gain: 0.018 },
    { frequency: 560, duration: 0.08, type: "triangle", gain: 0.018 },
    { frequency: 740, duration: 0.1, type: "triangle", gain: 0.019 },
    { frequency: 980, duration: 0.14, type: "sine", gain: 0.016 },
  ],
};

export class TacticalSoundEngine {
  private context: AudioContext | null = null;
  private musicEnabled = false;
  private musicVolume = 0.38;
  private musicTrack: HTMLAudioElement | null = null;
  private musicFadeTimer: number | null = null;
  private pendingMusicRetry = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!this.context) {
      this.context = new AudioContextCtor();
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  private ensureMusicTrack(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.musicTrack) return this.musicTrack;
    const audio = new Audio("/audio/tactical-loop.wav");
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.addEventListener("error", () => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[audio] tactical-loop failed to load.");
      }
    });
    this.musicTrack = audio;
    return audio;
  }

  private clearMusicFade(): void {
    if (this.musicFadeTimer !== null) {
      window.clearInterval(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
  }

  private fadeMusicTo(target: number, durationMs: number, onDone?: () => void): void {
    const audio = this.ensureMusicTrack();
    if (!audio) return;
    this.clearMusicFade();

    const clampedTarget = Math.max(0, Math.min(1, target));
    const stepMs = 30;
    const steps = Math.max(1, Math.floor(durationMs / stepMs));
    const stepDelta = (clampedTarget - audio.volume) / steps;
    this.musicFadeTimer = window.setInterval(() => {
      const current = audio.volume;
      const next = current + stepDelta;
      const reached = stepDelta >= 0 ? next >= clampedTarget : next <= clampedTarget;
      if (reached || Math.abs(clampedTarget - current) < 0.01) {
        audio.volume = clampedTarget;
        this.clearMusicFade();
        onDone?.();
        return;
      }
      audio.volume = Math.max(0, Math.min(1, next));
    }, stepMs);
  }

  private startMusicPlayback(): void {
    const audio = this.ensureMusicTrack();
    if (!audio) return;
    if (audio.paused) {
      void audio.play()
        .then(() => {
          this.pendingMusicRetry = false;
        })
        .catch(() => {
          this.pendingMusicRetry = true;
        });
    }
    this.fadeMusicTo(this.musicVolume, 280);
  }

  private stopMusicPlayback(hardStop = false): void {
    const audio = this.musicTrack;
    if (!audio) return;
    if (hardStop) {
      this.clearMusicFade();
      audio.volume = 0;
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    this.fadeMusicTo(0, 220, () => {
      audio.pause();
    });
  }

  setMusicVolume(volume: number): void {
    const next = Math.max(0, Math.min(1, volume));
    this.musicVolume = next;
    if (this.musicTrack && !this.musicTrack.paused) {
      this.fadeMusicTo(this.musicVolume, 180);
    }
  }

  primeMusic(): void {
    const context = this.ensureContext();
    if (context && context.state === "suspended") void context.resume();

    const track = this.ensureMusicTrack();
    if (track && track.paused) {
      track.muted = true;
      void track.play()
        .then(() => {
          track.pause();
          track.currentTime = 0;
          track.muted = false;
          if (this.musicEnabled) this.startMusicPlayback();
        })
        .catch(() => {
          track.muted = false;
        });
    }
  }

  private retryMusicIfNeeded(): void {
    if (!this.pendingMusicRetry || !this.musicEnabled) return;
    this.startMusicPlayback();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startMusicPlayback();
      return;
    }
    this.stopMusicPlayback(false);
  }

  play(cue: SoundCue): void {
    const context = this.ensureContext();
    if (!context) return;
    this.retryMusicIfNeeded();

    const now = context.currentTime;
    let offset = 0;

    for (const step of CUE_MAP[cue]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + offset;
      const end = start + step.duration;

      oscillator.type = step.type ?? "square";
      oscillator.frequency.setValueAtTime(step.frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(step.gain ?? 0.015, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.01);

      offset += step.duration + 0.012;
    }
  }

  // Backward compatibility for existing call sites.
  setAmbient(enabled: boolean): void {
    this.setMusicEnabled(enabled);
  }

  stopAmbient(): void {
    this.stopMusicPlayback(false);
  }
}
