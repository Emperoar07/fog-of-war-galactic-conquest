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
        masterGain: GainNode;
        pulseTimer: number;
        leadTimer: number;
        pulseStep: number;
        leadStep: number;
        bassOsc: OscillatorNode;
        bassGain: GainNode;
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

    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, context.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.005, context.currentTime + 0.35);
    masterGain.connect(context.destination);

    const bassOsc = context.createOscillator();
    const bassGain = context.createGain();
    bassOsc.type = "triangle";
    bassOsc.frequency.setValueAtTime(78, context.currentTime);
    bassGain.gain.setValueAtTime(0.0027, context.currentTime);
    bassOsc.connect(bassGain);
    bassGain.connect(masterGain);
    bassOsc.start();

    const pulsePattern = [156, 174, 196, 174, 156, 174, 220, 196];
    const leadPattern = [392, 440, 392, 330, 349, 392, 440, 523];

    const playPulse = () => {
      const nodes = this.ambientNodes;
      if (!nodes || !this.context) return;
      const now = this.context.currentTime;
      const frequency = pulsePattern[nodes.pulseStep % pulsePattern.length];
      nodes.pulseStep += 1;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.0018, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain);
      gain.connect(nodes.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    };

    const playLead = () => {
      const nodes = this.ambientNodes;
      if (!nodes || !this.context) return;
      const now = this.context.currentTime;
      const frequency = leadPattern[nodes.leadStep % leadPattern.length];
      nodes.leadStep += 1;

      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.0014, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(gain);
      gain.connect(nodes.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    };

    const pulseTimer = window.setInterval(playPulse, 260);
    const leadTimer = window.setInterval(playLead, 1040);

    playPulse();

    this.ambientNodes = {
      masterGain,
      pulseTimer,
      leadTimer,
      pulseStep: 0,
      leadStep: 0,
      bassOsc,
      bassGain,
    };
  }

  stopAmbient(): void {
    if (!this.context || !this.ambientNodes) return;

    const now = this.context.currentTime;
    window.clearInterval(this.ambientNodes.pulseTimer);
    window.clearInterval(this.ambientNodes.leadTimer);

    this.ambientNodes.masterGain.gain.cancelScheduledValues(now);
    this.ambientNodes.masterGain.gain.setValueAtTime(
      Math.max(this.ambientNodes.masterGain.gain.value, 0.0001),
      now,
    );
    this.ambientNodes.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    this.ambientNodes.bassGain.gain.cancelScheduledValues(now);
    this.ambientNodes.bassGain.gain.setValueAtTime(
      Math.max(this.ambientNodes.bassGain.gain.value, 0.0001),
      now,
    );
    this.ambientNodes.bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    this.ambientNodes.bassOsc.stop(now + 0.2);

    this.ambientNodes = null;
  }
}
