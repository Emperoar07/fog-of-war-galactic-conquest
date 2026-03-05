"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSound } from "@/components/SoundProvider";

const WalletButton = dynamic(
  () => import("@/components/WalletButtonClient"),
  { ssr: false },
);

export default function NavBar() {
  const { audioEnabled, toggleAudio, playSound } = useSound();

  const handleAudioToggle = () => {
    const enablingAudio = !audioEnabled;
    toggleAudio();
    if (enablingAudio) playSound("uiTap");
  };

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
        <button
          data-sound-ignore="true"
          onClick={handleAudioToggle}
          className="flex items-center gap-2 bg-[#021202] px-3 py-1.5"
          aria-pressed={audioEnabled}
          aria-label={audioEnabled ? "Disable sound effects" : "Enable sound effects"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              audioEnabled
                ? "animate-pulse bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.7)]"
                : "bg-[#0c6d1f]"
            }`}
          />
          <span className={`text-[8px] uppercase tracking-[0.18em] sm:text-[9px] ${audioEnabled ? "text-[#00ff41]" : "text-[#0c6d1f]"}`}>
            {audioEnabled ? "Audio On" : "Audio Off"}
          </span>
        </button>
      </div>
    </nav>
  );
}
