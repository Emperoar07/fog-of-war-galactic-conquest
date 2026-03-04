"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { TacticalSoundEngine, type SoundCue } from "@/lib/sound";

const STORAGE_KEY = "fog-of-war-audio-enabled";

type SoundContextValue = {
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  toggleAudio: () => void;
  playSound: (cue: SoundCue) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<TacticalSoundEngine | null>(null);
  const [audioEnabled, setAudioEnabledState] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  });

  const setAudioEnabled = useCallback((enabled: boolean) => {
    setAudioEnabledState(enabled);
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabledState((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const playSound = useCallback((cue: SoundCue) => {
    if (!audioEnabled) return;
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
    }
    engineRef.current.play(cue);
  }, [audioEnabled]);

  const value = useMemo(
    () => ({
      audioEnabled,
      setAudioEnabled,
      toggleAudio,
      playSound,
    }),
    [audioEnabled, playSound, setAudioEnabled, toggleAudio],
  );

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used within SoundProvider");
  }
  return context;
}
