"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import type { GalaxyMatch } from "@sdk";
import { useGameClient } from "./useGameClient";
import { getMatchPDA } from "@sdk";
import { createLocalMatch, type AiDifficulty } from "@/lib/demo";

export function useMatch(
  matchId: bigint | null,
  options: { localMode?: boolean; aiDifficulty?: AiDifficulty | null } = {},
) {
  const { localMode = false, aiDifficulty = null } = options;
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

      if (localMode) {
        setLoading(true);
        setError(null);
        const localMatch = createLocalMatch(matchId, aiDifficulty);
        setMatch(localMatch);
        setLoading(false);
        return localMatch;
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
  }, [aiDifficulty, client, localMode, matchId]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to account changes
  useEffect(() => {
    if (localMode) return;
    if (!client || !matchPDA) return;
    const subId = client.onMatchAccountChange(matchPDA, (updated) => {
      setMatch(updated);
    });
    return () => {
      client.removeAccountChangeListener(subId);
    };
  }, [client, localMode, matchPDA]);

  const updateMatch = useCallback(
    (updater: (current: GalaxyMatch) => GalaxyMatch) => {
      setMatch((current) => (current ? updater(current) : current));
    },
    [],
  );

  return { match, matchPDA, loading, error, refresh, updateMatch };
}
