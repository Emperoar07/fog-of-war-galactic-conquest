"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import Lobby from "@/components/Lobby";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import { DEMO_MATCH_ID } from "@/lib/demo";

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-800 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(145deg,_rgba(10,10,10,0.96),_rgba(17,24,39,0.92))] px-6 py-10 text-center shadow-2xl">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Fog Of War: Galactic Conquest
          </p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Private strategy. Public stakes.
          </h1>
          <p className="mx-auto max-w-2xl text-base text-gray-300 sm:text-lg">
            A two-player onchain strategy prototype on Solana, designed for
            hidden fleet positions, simultaneous turns, and selective reveals
            powered by Arcium.
          </p>
          <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
            <Link
              href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
              className="rounded-xl border border-cyan-700 bg-cyan-950/60 px-5 py-3 font-medium text-cyan-200 transition-colors hover:bg-cyan-900/70"
            >
              Try Demo Mode
            </Link>
            <span className="rounded-xl border border-gray-700 px-5 py-3 text-sm text-gray-400">
              Full UI demo works even if MXE is unavailable
            </span>
          </div>
        </div>
      </div>

      {connected ? (
        <>
          <MXEStatusBanner />
          <Lobby />
        </>
      ) : (
        <div className="rounded-3xl border border-gray-800 bg-gray-950/70 px-6 py-10 text-center">
          <p className="mb-4 text-lg text-gray-300">
            Connect your wallet for live devnet matches, or launch demo mode now.
          </p>
          <p className="text-sm text-gray-500">
            Supports Phantom, Solflare, and other Solana wallets
          </p>
          <div className="mt-6">
            <Link
              href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
              className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Open Demo Battlefield
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
