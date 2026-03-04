"use client";

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

  return (
    <div className="space-y-2">
      <section className="border border-[#0e2a0e] bg-[#030d03] px-5 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_260px] lg:items-center">
          <div className="space-y-5">
            <p className="text-[10px] uppercase tracking-[0.42em] text-[#0c6d1f]">
              Build an onchain game with encrypted state
            </p>
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.22em] text-[#00ff41] sm:text-5xl">
                FOG OF WAR
              </p>
              <h1 className="font-[family-name:var(--font-vt323)] text-4xl tracking-[0.16em] text-[#ffb000] sm:text-6xl">
                GALACTIC CONQUEST
              </h1>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-[#00cc33]">
              Card, strategy, and social-deduction games collapse when hidden
              hands, inventories, or positions are public. This prototype is
              built around Arcium-powered private computation so moves stay
              hidden, rule-required reveals stay selective, and the full
              battlefield can still settle on Solana.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
                className="inline-flex items-center justify-center border border-[#996800] bg-[rgba(255,176,0,0.05)] px-5 py-3 text-[10px] uppercase tracking-[0.28em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.11)]"
              >
                Launch Demo Loop
              </Link>
              <span className="inline-flex items-center justify-center border border-[#0e2a0e] px-5 py-3 text-[10px] uppercase tracking-[0.24em] text-[#0c6d1f]">
                No wallet required for demo mode
              </span>
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
