"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useSound } from "@/components/SoundProvider";

const WalletButton = dynamic(
  () => import("@/components/WalletButtonClient"),
  { ssr: false },
);

export default function NavBar() {
  const { musicEnabled, sfxEnabled, toggleMusic, toggleSfx, playSound } = useSound();
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);

  const handleMusicToggle = () => {
    const enabling = !musicEnabled;
    toggleMusic();
    if (enabling && sfxEnabled) playSound("uiTap");
  };

  const handleSfxToggle = () => {
    const enabling = !sfxEnabled;
    toggleSfx();
    if (enabling) playSound("uiTap");
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!audioMenuRef.current) return;
      const target = event.target as Node | null;
      if (target && audioMenuRef.current.contains(target)) return;
      setAudioMenuOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAudioMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03]">
      <div className="pointer-events-none absolute inset-y-0 left-[-40%] w-1/3 animate-[scanner_6s_linear_infinite] bg-linear-to-r from-transparent via-[rgba(0,255,65,0.05)] to-transparent" />

      {/* Primary bar: logo + wallet */}
      <div className="relative flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-[family-name:var(--font-vt323)] text-2xl tracking-[0.22em] text-[#00ff41] drop-shadow-[0_0_10px_rgba(0,255,65,0.28)] sm:text-3xl">
            FOG OF WAR
          </span>
          <span className="mt-0.5 font-[family-name:var(--font-vt323)] text-[11px] tracking-[0.16em] text-[#ffb000] drop-shadow-[0_0_10px_rgba(255,176,0,0.22)] sm:mt-1 sm:text-sm">
            GALACTIC CONQUEST
          </span>
        </Link>
        <WalletButton />
      </div>

      {/* HUD status strip */}
      <div className="relative grid grid-cols-2 gap-px border-t border-[#0e2a0e] bg-[#0e2a0e] sm:grid-cols-4">
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.6)]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#ffb000] sm:text-[9px]">
            Solana Devnet
          </span>
        </div>
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5cc] shadow-[0_0_8px_rgba(0,229,204,0.8)]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#00e5cc] sm:text-[9px]">
            Arcium MPC
          </span>
        </div>
        <div className="flex items-center gap-2 bg-[#021202] px-3 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.6)]" />
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#ffb000] sm:text-[9px]">
            Uplink Live
          </span>
        </div>
        <div ref={audioMenuRef} className="relative">
          <button
            data-sound-ignore="true"
            onClick={() => setAudioMenuOpen((open) => !open)}
            className="flex items-center gap-2 bg-[#021202] px-3 py-1.5"
            aria-expanded={audioMenuOpen}
            aria-haspopup="menu"
            aria-label="Open audio controls"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                musicEnabled || sfxEnabled
                  ? "animate-pulse bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.7)]"
                  : "bg-[#0c6d1f]"
              }`}
            />
            <span
              className={`text-[8px] uppercase tracking-[0.18em] sm:text-[9px] ${
                musicEnabled || sfxEnabled ? "text-[#00ff41]" : "text-[#0c6d1f]"
              }`}
            >
              Audio
            </span>
            <span className="text-[8px] text-[#0c6d1f] sm:text-[9px]">
              {audioMenuOpen ? "^" : "v"}
            </span>
          </button>

          {audioMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1.5 w-44 border border-[#0e2a0e] bg-[#021202] p-2"
            >
              <button
                data-sound-ignore="true"
                onClick={handleMusicToggle}
                className="flex w-full items-center justify-between border border-[#0e2a0e] bg-[#030d03] px-2 py-1.5 text-[8px] uppercase tracking-[0.18em] text-[#00cc33] hover:border-[#0c6d1f]"
                role="menuitemcheckbox"
                aria-checked={musicEnabled}
              >
                <span>Music</span>
                <span className={musicEnabled ? "text-[#00ff41]" : "text-[#0c6d1f]"}>
                  {musicEnabled ? "On" : "Off"}
                </span>
              </button>
              <button
                data-sound-ignore="true"
                onClick={handleSfxToggle}
                className="mt-1.5 flex w-full items-center justify-between border border-[#0e2a0e] bg-[#030d03] px-2 py-1.5 text-[8px] uppercase tracking-[0.18em] text-[#00cc33] hover:border-[#0c6d1f]"
                role="menuitemcheckbox"
                aria-checked={sfxEnabled}
              >
                <span>SFX</span>
                <span className={sfxEnabled ? "text-[#00ff41]" : "text-[#0c6d1f]"}>
                  {sfxEnabled ? "On" : "Off"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
