"use client";

import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { GameClient } from "@sdk";
import { CLUSTER_OFFSET, USE_LEGACY_DEVNET_ABI } from "@/lib/config";

export function useGameClient(): GameClient | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "processed",
      preflightCommitment: "processed",
    });
    return new GameClient(provider, CLUSTER_OFFSET, undefined, {
      useLegacyDevnetAbi: USE_LEGACY_DEVNET_ABI,
    });
  }, [connection, wallet]);
}
