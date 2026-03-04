"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import type { GalaxyMatch } from "@sdk";
import { useGameClient } from "./useGameClient";
import { getMatchPDA } from "@sdk";
import { createDemoMatch } from "@/lib/demo";

export function useMatch(matchId: bigint | null, demoMode = false) {
  const client = useGameClient();
  const [match, setMatch] = useState<GalaxyMatch | null>(null);
  const [matchPDA, setMatchPDA] = useState<PublicKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<GalaxyMatch | null> => {
    if (matchId === null) {
      setLoading(false);
      setMatch(null);
      setMatchPDA(null);
      return null;
    }

    try {
      const [pda] = getMatchPDA(matchId);
      setMatchPDA(pda);

      if (demoMode) {
        setLoading(true);
        setError(null);
        const demoMatch = createDemoMatch(matchId);
        setMatch(demoMatch);
        setLoading(false);
        return demoMatch;
      }

      if (!client) {
        setLoading(false);
        setError("Connect a wallet to load live match state.");
        setMatch(null);
        return null;
      }

      setLoading(true);
      setError(null);
      const data = await client.fetchMatch(pda);
      setMatch(data);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load match");
      setMatch(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [client, demoMode, matchId]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to account changes
  useEffect(() => {
    if (demoMode) return;
    if (!client || !matchPDA) return;
    const subId = client.onMatchAccountChange(matchPDA, (updated) => {
      setMatch(updated);
    });
    return () => {
      client.removeAccountChangeListener(subId);
    };
  }, [client, demoMode, matchPDA]);

  const updateMatch = useCallback(
    (updater: (current: GalaxyMatch) => GalaxyMatch) => {
      setMatch((current) => (current ? updater(current) : current));
    },
    [],
  );

  return { match, matchPDA, loading, error, refresh, updateMatch };
}
