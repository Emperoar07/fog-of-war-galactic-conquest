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

export type MusicProfile = "landing" | "gameplay";

type CueStep = {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
};

const CUE_MAP: Record<Exclude<SoundCue, "victory">, CueStep[]> = {
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
};

export class TacticalSoundEngine {
  private context: AudioContext | null = null;
  private musicEnabled = false;
  private musicProfile: MusicProfile = "landing";
  private musicVolume = 0.38;
  private sfxVolume = 0.8;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicBus: GainNode | null = null;
  private victoryTimer: number | null = null;
  private victoryStep = 0;

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

  private tone(
    context: AudioContext,
    destination: AudioNode,
    frequency: number,
    type: OscillatorType,
    duration: number,
    volume: number,
    env: "pluck" | "pad" | "stab" = "pluck",
    gainScale = 1,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);

    if (env === "pluck") {
      gain.gain.linearRampToValueAtTime(volume * gainScale, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    } else if (env === "pad") {
      gain.gain.linearRampToValueAtTime(volume * gainScale, now + Math.min(0.4, duration * 0.3));
      gain.gain.setValueAtTime(volume * gainScale, now + Math.max(0.02, duration - 0.15));
      gain.gain.linearRampToValueAtTime(0.001, now + duration);
    } else {
      gain.gain.linearRampToValueAtTime(volume * gainScale, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.03, duration * 0.25));
    }

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  private kick(
    context: AudioContext,
    destination: AudioNode,
    vol = 1.0,
    gainScale = 1,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.exponentialRampToValueAtTime(28, now + 0.14);
    gain.gain.setValueAtTime(vol * gainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }

  private snare(
    context: AudioContext,
    destination: AudioNode,
    gainScale = 1,
  ): void {
    const size = Math.floor(context.sampleRate * 0.12);
    const buffer = context.createBuffer(1, size, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;

    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.7;
    src.buffer = buffer;
    gain.gain.setValueAtTime(0.35 * gainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    src.start(now);
    src.stop(now + 0.13);
  }

  private hat(
    context: AudioContext,
    destination: AudioNode,
    vol = 0.08,
    gainScale = 1,
  ): void {
    const size = Math.floor(context.sampleRate * 0.04);
    const buffer = context.createBuffer(1, size, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;

    filter.type = "highpass";
    filter.frequency.value = 7000;
    src.buffer = buffer;
    gain.gain.setValueAtTime(vol * gainScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    src.start(now);
    src.stop(now + 0.05);
  }

  private stopVictoryTransmission(): void {
    if (this.victoryTimer !== null) {
      window.clearInterval(this.victoryTimer);
      this.victoryTimer = null;
    }
    this.victoryStep = 0;
  }

  private playVictoryTransmission(context: AudioContext): void {
    this.stopVictoryTransmission();

    const MEL = [
      261.63, 329.63, 392, 493.88, 523.25, 493.88, 392, 329.63,
      261.63, 329.63, 392, 523.25, 587.33, 523.25, 392, 329.63,
    ];
    const BAS = [
      130.81, 0, 130.81, 0, 164.81, 0, 130.81, 0,
      130.81, 0, 130.81, 0, 174.61, 0, 130.81, 0,
    ];
    const stepMs = 300; // 100 BPM at /2 grid

    const tick = () => {
      const idx = this.victoryStep % 16;
      if (idx % 4 === 0) this.kick(context, context.destination, 0.7, this.sfxVolume);
      if (idx % 8 === 4) this.snare(context, context.destination, this.sfxVolume);
      this.hat(context, context.destination, 0.05, this.sfxVolume);
      this.tone(
        context,
        context.destination,
        MEL[idx],
        "triangle",
        0.28,
        0.17,
        "pluck",
        this.sfxVolume,
      );
      this.tone(
        context,
        context.destination,
        MEL[idx] * 1.26,
        "sine",
        0.24,
        0.07,
        "pluck",
        this.sfxVolume,
      );
      if (BAS[idx]) {
        this.tone(
          context,
          context.destination,
          BAS[idx],
          "sine",
          0.3,
          0.2,
          "pluck",
          this.sfxVolume,
        );
      }

      this.victoryStep += 1;
      if (this.victoryStep >= 16) {
        this.stopVictoryTransmission();
      }
    };

    tick();
    this.victoryTimer = window.setInterval(tick, stepMs);
  }

  private startLandingModule9Music(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (this.musicTimer !== null) return;

    const LED = [
      164.81, 0, 164.81, 0, 196, 164.81, 0, 185,
      164.81, 0, 196, 0, 220, 196, 185, 164.81,
    ];
    const BAS = [
      82.41, 0, 0, 82.41, 0, 0, 98, 0,
      82.41, 0, 0, 82.41, 0, 92.5, 0, 0,
    ];
    const stepMs = 125; // ms(120,4)
    this.musicStep = 0;

    const bus = context.createGain();
    bus.gain.setValueAtTime(0.001, context.currentTime);
    bus.gain.linearRampToValueAtTime(this.musicVolume, context.currentTime + 0.28);
    bus.connect(context.destination);
    this.musicBus = bus;

    const tick = () => {
      if (!this.musicEnabled || !this.musicBus) return;
      const activeContext = this.ensureContext();
      if (!activeContext) return;
      const idx = this.musicStep % 16;

      if ([0, 2, 4, 8, 10].includes(idx)) {
        this.kick(activeContext, this.musicBus, 0.85);
      }
      if ([4, 12].includes(idx)) {
        this.snare(activeContext, this.musicBus);
      }
      this.hat(activeContext, this.musicBus, 0.1);
      if (LED[idx]) {
        this.tone(activeContext, this.musicBus, LED[idx], "sawtooth", 0.09, 0.2, "stab");
      }
      if (BAS[idx]) {
        this.tone(activeContext, this.musicBus, BAS[idx], "square", 0.09, 0.24, "pluck");
      }
      this.musicStep = (this.musicStep + 1) % 16;
    };

    tick();
    this.musicTimer = window.setInterval(tick, stepMs);
  }

  private startGameplayModule8Music(): void {
    const context = this.ensureContext();
    if (!context) return;
    if (this.musicTimer !== null) return;

    const SP = [
      174.61, 0, 0, 0, 0, 0, 0, 207.65,
      0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const stepMs = (60000 / 65) / 2; // ms(65,2)
    this.musicStep = 0;

    const bus = context.createGain();
    bus.gain.setValueAtTime(0.001, context.currentTime);
    bus.gain.linearRampToValueAtTime(this.musicVolume, context.currentTime + 0.28);
    bus.connect(context.destination);
    this.musicBus = bus;

    this.tone(context, this.musicBus, 87.31, "sine", 5, 0.18, "pad");
    this.tone(context, this.musicBus, 130.81, "sine", 5, 0.09, "pad");

    const tick = () => {
      if (!this.musicEnabled || !this.musicBus) return;
      const activeContext = this.ensureContext();
      if (!activeContext) return;
      const idx = this.musicStep % 16;

      if (SP[idx] > 0) {
        this.tone(activeContext, this.musicBus, SP[idx], "triangle", 0.85, 0.17, "pluck");
        this.tone(activeContext, this.musicBus, SP[idx] * 2, "sine", 0.6, 0.06, "pluck");
      }
      if (idx % 16 === 0) {
        this.tone(activeContext, this.musicBus, 32.7, "sine", 0.6, 0.35, "pluck");
      }
      if (idx % 8 === 0) {
        this.tone(activeContext, this.musicBus, 87.31, "sine", 2.2, 0.14, "pad");
      }
      if (idx % 13 === 5) {
        this.tone(activeContext, this.musicBus, 1760, "sine", 0.04, 0.04, "stab");
      }
      this.musicStep = (this.musicStep + 1) % 16;
    };

    tick();
    this.musicTimer = window.setInterval(tick, stepMs);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const context = this.context;
    const bus = this.musicBus;
    this.musicBus = null;
    if (context && bus) {
      const now = context.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.001), now);
      bus.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      window.setTimeout(() => {
        try {
          bus.disconnect();
        } catch {
          // ignore
        }
      }, 260);
    }
    this.musicStep = 0;
  }

  private startMusicLoop(): void {
    if (this.musicProfile === "gameplay") {
      this.startGameplayModule8Music();
      return;
    }
    this.startLandingModule9Music();
  }

  setMusicVolume(volume: number): void {
    const next = Math.max(0, Math.min(1, volume));
    this.musicVolume = next;
    if (this.context && this.musicBus) {
      const now = this.context.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(Math.max(this.musicBus.gain.value, 0.001), now);
      this.musicBus.gain.linearRampToValueAtTime(this.musicVolume, now + 0.18);
    }
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  primeMusic(): void {
    const context = this.ensureContext();
    if (context && context.state === "suspended") {
      void context.resume();
    }
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startMusicLoop();
      return;
    }
    this.stopMusicLoop();
  }

  setMusicProfile(profile: MusicProfile): void {
    if (this.musicProfile === profile) return;
    this.musicProfile = profile;
    if (!this.musicEnabled) return;
    this.stopMusicLoop();
    this.startMusicLoop();
  }

  play(cue: SoundCue): void {
    const context = this.ensureContext();
    if (!context) return;
    if (cue === "victory") {
      this.playVictoryTransmission(context);
      return;
    }

    const steps = CUE_MAP[cue];
    const now = context.currentTime;
    let offset = 0;

    for (const step of steps) {
      const start = now + offset;
      const end = start + step.duration;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = step.type ?? "square";
      oscillator.frequency.setValueAtTime(step.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        (step.gain ?? 0.015) * this.sfxVolume,
        start + 0.01,
      );
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
    this.setMusicEnabled(false);
  }
}
