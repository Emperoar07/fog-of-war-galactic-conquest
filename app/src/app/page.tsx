"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import { DEMO_MATCH_ID } from "@/lib/demo";

const Lobby = dynamic(() => import("@/components/Lobby"), {
  loading: () => (
    <div className="border border-[#0e2a0e] bg-[#030d03] px-4 py-10 text-center text-xs uppercase tracking-[0.24em] text-[#0c6d1f]">
      Syncing lobby feed...
    </div>
  ),
});

export default function Home() {
  const { connected } = useWallet();
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="space-y-2">
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-2xl border border-[#0c6d1f] bg-[#030d03] p-6 shadow-[0_0_40px_rgba(0,255,65,0.08)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.34em] text-[#0c6d1f]">
                  Mission Briefing
                </div>
                <h2 className="mt-1 font-[family-name:var(--font-vt323)] text-4xl tracking-[0.14em] text-[#00ff41]">
                  HOW TO PLAY
                </h2>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="border border-[#0e2a0e] bg-[#021202] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00aa2a] hover:border-[#0c6d1f] hover:text-[#00ff41]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#0e2a0e] bg-[#021202] p-4">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#ffb000]">
                  Demo Mode
                </div>
                <ol className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                  <li>1. Launch the demo match from the landing page.</li>
                  <li>2. Click sectors on the battlefield to choose a target.</li>
                  <li>3. Queue a mock order and resolve a simulated turn.</li>
                  <li>4. Request visibility to see a fake scout report update.</li>
                </ol>
              </div>

              <div className="border border-[#0e2a0e] bg-[#021202] p-4">
                <div className="text-[9px] uppercase tracking-[0.24em] text-[#00e5cc]">
                  Live Devnet
                </div>
                <ol className="mt-3 space-y-2 text-xs leading-6 text-[#00cc33]">
                  <li>1. Connect a Solana wallet such as Phantom or Solflare.</li>
                  <li>2. Create or join a live match in the lobby.</li>
                  <li>3. Submit one encrypted order for the current turn.</li>
                  <li>4. Resolve the turn once all players have submitted.</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 border border-[#005f52] bg-[rgba(0,229,204,0.03)] p-4 text-xs leading-6 text-[#00e5cc]">
              Demo mode is fully playable today. Live encrypted gameplay works
              when the Arcium MXE devnet cluster is ready.
            </div>
          </div>
        </div>
      )}

      <section className="border border-[#0e2a0e] bg-[#030d03] px-5 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_260px] lg:items-center">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.22em] text-[#00ff41] sm:text-5xl">
                FOG OF WAR
              </p>
              <h1 className="font-[family-name:var(--font-vt323)] text-4xl tracking-[0.16em] text-[#ffb000] sm:text-6xl">
                GALACTIC CONQUEST
              </h1>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-[#00cc33]">
              Hidden information is what makes strategy feel real. Fog of War:
              Galactic Conquest uses Arcium-powered private computation to keep
              moves concealed, reveal only what the rules allow, and still
              settle the fight on Solana.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
                className="inline-flex items-center justify-center border border-[#996800] bg-[rgba(255,176,0,0.05)] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.11)]"
              >
                Launch Demo Loop
              </Link>
              <button
                onClick={() => setShowGuide(true)}
                className="inline-flex items-center justify-center border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-5 py-3 text-[10px] uppercase tracking-[0.24em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)]"
              >
                How To Play
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            {[
              ["01", "Commit", "Queue encrypted match setup and hidden state."],
              ["02", "Compute", "Resolve turns with private Arcium MPC."],
              ["03", "Reveal", "Emit only the public outcome the rules allow."],
            ].map(([step, title, text]) => (
              <div
                key={step}
                className="border border-[#0e2a0e] bg-[#021202] px-4 py-3"
              >
                <div className="text-[9px] uppercase tracking-[0.26em] text-[#0c6d1f]">
                  {step}
                </div>
                <div className="mt-1 font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00ff41]">
                  {title}
                </div>
                <div className="mt-1 text-xs leading-5 text-[#00aa2a]">
                  {text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {connected ? (
        <div className="space-y-2">
          <MXEStatusBanner />
          <Lobby />
        </div>
      ) : (
        <section className="border border-[#0e2a0e] bg-[#030d03] px-5 py-8 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-[#00cc33]">
            Connect a wallet for live devnet matches
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#0c6d1f]">
            Phantom, Solflare, and compatible Solana wallets supported
          </p>
        </section>
      )}
    </div>
  );
}
