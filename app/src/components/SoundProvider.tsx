"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TacticalSoundEngine,
  type MusicProfile,
  type SoundCue,
} from "@/lib/sound";

const STORAGE_AUDIO_KEY = "fog-of-war-audio-enabled";
const STORAGE_MUSIC_KEY = "fog-of-war-music-enabled";
const STORAGE_SFX_KEY = "fog-of-war-sfx-enabled";

type SoundContextValue = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  audioEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  setSfxEnabled: (enabled: boolean) => void;
  toggleMusic: () => void;
  toggleSfx: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  toggleAudio: () => void;
  setMusicProfile: (profile: MusicProfile) => void;
  playSound: (cue: SoundCue) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<TacticalSoundEngine | null>(null);
  const musicEnabledRef = useRef(true);
  const sfxEnabledRef = useRef(true);
  const [musicEnabled, setMusicEnabledState] = useState(() => {
    if (typeof window === "undefined") return true;
    const explicit = window.localStorage.getItem(STORAGE_MUSIC_KEY);
    if (explicit !== null) return explicit === "1";
    return true;
  });
  const [sfxEnabled, setSfxEnabledState] = useState(() => {
    if (typeof window === "undefined") return true;
    const explicit = window.localStorage.getItem(STORAGE_SFX_KEY);
    if (explicit !== null) return explicit === "1";
    return true;
  });
  const audioEnabled = musicEnabled || sfxEnabled;

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    sfxEnabledRef.current = sfxEnabled;
  }, [sfxEnabled]);

  const setMusicEnabled = useCallback((enabled: boolean) => {
    setMusicEnabledState(enabled);
    window.localStorage.setItem(STORAGE_MUSIC_KEY, enabled ? "1" : "0");
  }, []);

  const setSfxEnabled = useCallback((enabled: boolean) => {
    setSfxEnabledState(enabled);
    window.localStorage.setItem(STORAGE_SFX_KEY, enabled ? "1" : "0");
  }, []);

  const setAudioEnabled = useCallback((enabled: boolean) => {
    setMusicEnabled(enabled);
    setSfxEnabled(enabled);
    window.localStorage.setItem(STORAGE_AUDIO_KEY, enabled ? "1" : "0");
  }, [setMusicEnabled, setSfxEnabled]);

  const toggleMusic = useCallback(() => {
    setMusicEnabledState((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_MUSIC_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const toggleSfx = useCallback(() => {
    setSfxEnabledState((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_SFX_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const toggleAudio = useCallback(() => {
    const next = !(musicEnabledRef.current || sfxEnabledRef.current);
    setAudioEnabled(next);
  }, [setAudioEnabled]);

  const setMusicProfile = useCallback((profile: MusicProfile) => {
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
      engineRef.current.setMusicVolume(0.38);
    }
    engineRef.current.setMusicProfile(profile);
  }, []);

  const playSound = useCallback((cue: SoundCue) => {
    if (!sfxEnabled) return;
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
    }
    engineRef.current.play(cue);
  }, [sfxEnabled]);

  const value = useMemo(
    () => ({
      musicEnabled,
      sfxEnabled,
      audioEnabled,
      setMusicEnabled,
      setSfxEnabled,
      toggleMusic,
      toggleSfx,
      setAudioEnabled,
      toggleAudio,
      setMusicProfile,
      playSound,
    }),
    [
      musicEnabled,
      sfxEnabled,
      audioEnabled,
      setMusicEnabled,
      setSfxEnabled,
      toggleMusic,
      toggleSfx,
      setAudioEnabled,
      toggleAudio,
      setMusicProfile,
      playSound,
    ],
  );

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
      engineRef.current.setMusicVolume(0.38);
    }

    engineRef.current.setMusicEnabled(musicEnabled);
  }, [musicEnabled]);

  useEffect(() => {
    const primeAudio = () => {
      if (!engineRef.current) {
        engineRef.current = new TacticalSoundEngine();
        engineRef.current.setMusicVolume(0.38);
      }
      engineRef.current.primeMusic();
      engineRef.current.setMusicEnabled(musicEnabledRef.current);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-sound-ignore='true']")) return;
      if (target?.closest("[data-sound-manual='true']")) return;
      if (!target?.closest("button")) return;
      if (!sfxEnabledRef.current) return;
      if (!engineRef.current) {
        engineRef.current = new TacticalSoundEngine();
      }
      engineRef.current.play("uiTap");
    };

    window.addEventListener("pointerdown", primeAudio, { once: true });
    document.addEventListener("click", handlePointerDown, true);

    return () => {
      document.removeEventListener("click", handlePointerDown, true);
    };
  }, []);

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
