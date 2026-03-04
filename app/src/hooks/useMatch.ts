"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import type { GalaxyMatch } from "@sdk";
import { useGameClient } from "./useGameClient";
import { getMatchPDA } from "@sdk";

export function useMatch(matchId: bigint | null) {
  const client = useGameClient();
  const [match, setMatch] = useState<GalaxyMatch | null>(null);
  const [matchPDA, setMatchPDA] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!client || matchId === null) return;
    try {
      setLoading(true);
      setError(null);
      const [pda] = getMatchPDA(matchId);
      setMatchPDA(pda);
      const data = await client.fetchMatch(pda);
      setMatch(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch match");
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [client, matchId]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to account changes
  useEffect(() => {
    if (!client || !matchPDA) return;
    const subId = client.onMatchAccountChange(matchPDA, (updated) => {
      setMatch(updated);
    });
    return () => {
      client.removeAccountChangeListener(subId);
    };
  }, [client, matchPDA]);

  return { match, matchPDA, loading, error, refresh };
}
