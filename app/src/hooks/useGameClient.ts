"use client";

import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { GameClient } from "@sdk";
import { CLUSTER_OFFSET } from "@/lib/config";

export function useGameClient(): GameClient | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new GameClient(provider, CLUSTER_OFFSET);
  }, [connection, wallet]);
}
