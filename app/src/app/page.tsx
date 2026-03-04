"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import { DEMO_MATCH_ID } from "@/lib/demo";

const Lobby = dynamic(() => import("@/components/Lobby"), {
  loading: () => (
    <div className="text-center py-8 text-slate-400 text-sm">Loading lobby...</div>
  ),
});

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="pt-12 pb-4 text-center space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Fog of War
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
          Galactic Conquest
        </h1>
        <p className="mx-auto max-w-xl text-base text-slate-500 leading-relaxed">
          A two-player encrypted strategy game on Solana. Hidden fleet
          positions, simultaneous turns, and selective reveals — powered by
          Arcium multi-party computation.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
          <Link
            href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            Try Demo
          </Link>
          <span className="rounded-lg border border-slate-200 px-6 py-3 text-sm text-slate-400">
            No wallet required for demo
          </span>
        </div>
      </section>

      {/* How it works */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div className="space-y-2">
          <div className="text-2xl">01</div>
          <h3 className="font-semibold text-slate-800">Create a Match</h3>
          <p className="text-sm text-slate-500">
            Deploy an on-chain match with encrypted initial state via Arcium MPC.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-2xl">02</div>
          <h3 className="font-semibold text-slate-800">Submit Orders</h3>
          <p className="text-sm text-slate-500">
            Encrypt your fleet commands client-side. Neither player sees the other&apos;s moves.
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-2xl">03</div>
          <h3 className="font-semibold text-slate-800">Resolve &amp; Reveal</h3>
          <p className="text-sm text-slate-500">
            MPC resolves combat and selectively reveals results. No trusted server.
          </p>
        </div>
      </section>

      <hr className="border-slate-100" />

      {/* Connected lobby or connect prompt */}
      {connected ? (
        <div className="space-y-6">
          <MXEStatusBanner />
          <Lobby />
        </div>
      ) : (
        <section className="text-center py-10 space-y-3">
          <p className="text-slate-500">
            Connect your wallet to browse live devnet matches, or try the demo above.
          </p>
          <p className="text-sm text-slate-400">
            Supports Phantom, Solflare, and other Solana wallets
          </p>
        </section>
      )}
    </div>
  );
}
