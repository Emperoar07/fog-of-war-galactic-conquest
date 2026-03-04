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

  return (
    <nav className="relative z-40 overflow-visible border border-[#0e2a0e] bg-[#030d03] px-4 py-3 sm:px-5">
      <div className="pointer-events-none absolute inset-y-0 left-[-40%] w-1/3 animate-[scanner_6s_linear_infinite] bg-linear-to-r from-transparent via-[rgba(0,255,65,0.05)] to-transparent" />
      <div className="relative grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex flex-col leading-none">
          <Link
            href="/"
            className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.28em] text-[#00ff41] drop-shadow-[0_0_10px_rgba(0,255,65,0.28)]"
          >
            FOG OF WAR
          </Link>
          <span className="mt-1 text-[9px] uppercase tracking-[0.38em] text-[#0c6d1f]">
            Galactic Conquest
          </span>
        </div>

        <div className="grid gap-1 border border-[#0e2a0e] bg-[#021202] px-4 py-2 text-center">
          <span className="text-[8px] uppercase tracking-[0.34em] text-[#0c6d1f]">
            Tactical Uplink
          </span>
          <span className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.16em] text-[#ffb000]">
            LIVE
          </span>
          <span className="text-[8px] uppercase tracking-[0.24em] text-[#00aa2a]">
            Demo + Devnet Channels Armed
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <button
            onClick={() => {
              playSound("uiTap");
              toggleAudio();
            }}
            className={`inline-flex items-center gap-2 border px-3 py-1 text-[9px] uppercase tracking-[0.22em] ${
              audioEnabled
                ? "border-[rgba(0,255,65,0.3)] bg-[rgba(0,255,65,0.04)] text-[#00ff41]"
                : "border-[#0e2a0e] bg-[#021202] text-[#0c6d1f]"
            }`}
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
            {audioEnabled ? "Audio On" : "Audio Off"}
          </button>
          <span className="inline-flex items-center gap-2 border border-[rgba(0,229,204,0.3)] bg-[rgba(0,229,204,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.22em] text-[#00e5cc]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00e5cc] shadow-[0_0_8px_rgba(0,229,204,0.8)]" />
            Arcium MPC
          </span>
          <span className="inline-flex items-center gap-2 border border-[rgba(255,176,0,0.28)] bg-[rgba(255,176,0,0.04)] px-3 py-1 text-[9px] uppercase tracking-[0.22em] text-[#ffb000]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.6)]" />
            Solana Devnet
          </span>
          <WalletButton />
        </div>
      </div>
    </nav>
  );
}
