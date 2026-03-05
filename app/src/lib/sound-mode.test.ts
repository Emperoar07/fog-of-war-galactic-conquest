import test from "node:test";
import assert from "node:assert/strict";
import { TacticalSoundEngine } from "./sound";

class FakeAudioParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
  cancelScheduledValues(): void {}
}

class FakeNode {
  connect(): void {}
  disconnect(): void {}
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  start(): void {}
  stop(): void {}
}

class FakeGainNode extends FakeNode {
  gain = new FakeAudioParam();
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  start(): void {}
  stop(): void {}
}

class FakeBiquadFilter extends FakeNode {
  type: BiquadFilterType = "lowpass";
  frequency = { value: 0 };
  Q = { value: 0 };
}

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  sampleRate = 48_000;
  destination = new FakeNode() as unknown as AudioDestinationNode;

  createOscillator(): OscillatorNode {
    return new FakeOscillator() as unknown as OscillatorNode;
  }

  createGain(): GainNode {
    return new FakeGainNode() as unknown as GainNode;
  }

  createBuffer(_channels: number, length: number): AudioBuffer {
    return {
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }

  createBufferSource(): AudioBufferSourceNode {
    return new FakeBufferSource() as unknown as AudioBufferSourceNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new FakeBiquadFilter() as unknown as BiquadFilterNode;
  }

  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }
}

test("victory mode pauses gameplay music and resumes it when closed", () => {
  const prevWindow = (globalThis as unknown as { window?: Window }).window;

  (globalThis as unknown as { window: Window }).window = {
    ...(globalThis as unknown as { window?: Window }).window,
    AudioContext: FakeAudioContext as unknown as typeof AudioContext,
    webkitAudioContext: undefined,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  } as unknown as Window;

  try {
    const engine = new TacticalSoundEngine() as unknown as {
      setMusicProfile: (profile: "landing" | "gameplay") => void;
      setMusicEnabled: (enabled: boolean) => void;
      startVictoryMode: () => void;
      stopVictoryMode: () => void;
      musicTimer: number | null;
      victoryTimer: number | null;
      victoryModeActive: boolean;
    };

    engine.setMusicProfile("gameplay");
    engine.setMusicEnabled(true);
    assert.notEqual(engine.musicTimer, null);

    engine.startVictoryMode();
    assert.equal(engine.musicTimer, null);
    assert.notEqual(engine.victoryTimer, null);
    assert.equal(engine.victoryModeActive, true);

    engine.stopVictoryMode();
    assert.equal(engine.victoryTimer, null);
    assert.equal(engine.victoryModeActive, false);
    assert.notEqual(engine.musicTimer, null);

    engine.setMusicEnabled(false);
    assert.equal(engine.musicTimer, null);
  } finally {
    if (prevWindow) {
      (globalThis as unknown as { window: Window }).window = prevWindow;
    } else {
      delete (globalThis as unknown as { window?: Window }).window;
    }
  }
});
