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
  private ambientNodes:
    | {
        oscillators: OscillatorNode[];
        gains: GainNode[];
      }
    | null = null;

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

  play(cue: SoundCue): void {
    const context = this.ensureContext();
    if (!context) return;

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

  setAmbient(enabled: boolean): void {
    const context = this.ensureContext();
    if (!context) return;

    if (!enabled) {
      this.stopAmbient();
      return;
    }

    if (this.ambientNodes) return;

    const primaryOsc = context.createOscillator();
    const shimmerOsc = context.createOscillator();
    const primaryGain = context.createGain();
    const shimmerGain = context.createGain();

    primaryOsc.type = "triangle";
    primaryOsc.frequency.setValueAtTime(92, context.currentTime);
    shimmerOsc.type = "sine";
    shimmerOsc.frequency.setValueAtTime(184, context.currentTime);

    primaryGain.gain.setValueAtTime(0.0001, context.currentTime);
    primaryGain.gain.linearRampToValueAtTime(0.0045, context.currentTime + 0.4);
    shimmerGain.gain.setValueAtTime(0.0001, context.currentTime);
    shimmerGain.gain.linearRampToValueAtTime(0.0025, context.currentTime + 0.45);

    primaryOsc.connect(primaryGain);
    shimmerOsc.connect(shimmerGain);
    primaryGain.connect(context.destination);
    shimmerGain.connect(context.destination);

    primaryOsc.start();
    shimmerOsc.start();

    this.ambientNodes = {
      oscillators: [primaryOsc, shimmerOsc],
      gains: [primaryGain, shimmerGain],
    };
  }

  stopAmbient(): void {
    if (!this.context || !this.ambientNodes) return;

    const now = this.context.currentTime;
    for (const gain of this.ambientNodes.gains) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    }

    for (const oscillator of this.ambientNodes.oscillators) {
      oscillator.stop(now + 0.2);
    }

    this.ambientNodes = null;
  }
}
