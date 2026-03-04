"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Lobby from "@/components/Lobby";
import MXEStatusBanner from "@/components/MXEStatusBanner";

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-8">
        <h1 className="text-4xl font-bold">Galactic Conquest</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Two-player encrypted strategy game on Solana. Hidden fleet positions,
          simultaneous turns, powered by Arcium MPC.
        </p>
      </div>

      {connected ? (
        <>
          <MXEStatusBanner />
          <Lobby />
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">
            Connect your wallet to start playing
          </p>
          <p className="text-gray-600 text-sm">
            Supports Phantom, Solflare, and other Solana wallets
          </p>
        </div>
      )}
    </div>
  );
}
