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
import { usePathname } from "next/navigation";

const STORAGE_AUDIO_KEY = "fog-of-war-audio-enabled";
const STORAGE_MUSIC_KEY = "fog-of-war-music-enabled";
const STORAGE_SFX_KEY = "fog-of-war-sfx-enabled";
const STORAGE_MUSIC_VOLUME_KEY = "fog-of-war-music-volume";
const STORAGE_SFX_VOLUME_KEY = "fog-of-war-sfx-volume";

function parseStoredVolume(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

type SoundContextValue = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  audioEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  setMusicEnabled: (enabled: boolean) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  toggleMusic: () => void;
  toggleSfx: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  toggleAudio: () => void;
  setMusicProfile: (profile: MusicProfile) => void;
  playSound: (cue: SoundCue) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
  const [musicVolume, setMusicVolumeState] = useState(() => {
    if (typeof window === "undefined") return 0.38;
    return parseStoredVolume(
      window.localStorage.getItem(STORAGE_MUSIC_VOLUME_KEY),
      0.38,
    );
  });
  const [sfxVolume, setSfxVolumeState] = useState(() => {
    if (typeof window === "undefined") return 0.8;
    return parseStoredVolume(
      window.localStorage.getItem(STORAGE_SFX_VOLUME_KEY),
      0.8,
    );
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

  const setMusicVolume = useCallback((volume: number) => {
    const next = Math.max(0, Math.min(1, volume));
    setMusicVolumeState(next);
    window.localStorage.setItem(STORAGE_MUSIC_VOLUME_KEY, String(next));
  }, []);

  const setSfxVolume = useCallback((volume: number) => {
    const next = Math.max(0, Math.min(1, volume));
    setSfxVolumeState(next);
    window.localStorage.setItem(STORAGE_SFX_VOLUME_KEY, String(next));
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
      musicVolume,
      sfxVolume,
      setMusicEnabled,
      setSfxEnabled,
      setMusicVolume,
      setSfxVolume,
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
      musicVolume,
      sfxVolume,
      setMusicEnabled,
      setSfxEnabled,
      setMusicVolume,
      setSfxVolume,
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
      engineRef.current.setMusicVolume(musicVolume);
      engineRef.current.setSfxVolume(sfxVolume);
    }
    const profile: MusicProfile =
      pathname?.startsWith("/match/") ? "gameplay" : "landing";
    engineRef.current.setMusicProfile(profile);
  }, [musicVolume, pathname, sfxVolume]);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
      engineRef.current.setMusicVolume(musicVolume);
      engineRef.current.setSfxVolume(sfxVolume);
    }

    engineRef.current.setMusicEnabled(musicEnabled);
  }, [musicEnabled, musicVolume, sfxVolume]);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
    }
    engineRef.current.setMusicVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new TacticalSoundEngine();
    }
    engineRef.current.setSfxVolume(sfxVolume);
  }, [sfxVolume]);

  useEffect(() => {
    const primeAudio = () => {
      if (!engineRef.current) {
        engineRef.current = new TacticalSoundEngine();
        engineRef.current.setMusicVolume(musicVolume);
        engineRef.current.setSfxVolume(sfxVolume);
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
  }, [musicVolume, sfxVolume]);

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
