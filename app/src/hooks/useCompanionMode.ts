"use client";

import { useCallback, useMemo, useState } from "react";
import type { DecodedVisibilityReport, GalaxyMatch, OrderParams } from "@sdk";
import {
  buildCompanionSuggestion,
  createCompanionHistoryEntry,
  type CompanionHistoryEntry,
  type CompanionSuggestion,
} from "@/lib/companion";

export function useCompanionMode(args: {
  match: GalaxyMatch | null;
  matchId: bigint | null;
  playerSlot: number | null;
  selectedCell: { x: number; y: number } | null;
  visibilityReport: DecodedVisibilityReport | null;
}) {
  const { match, matchId, playerSlot, selectedCell, visibilityReport } = args;
  const matchKey = matchId?.toString() ?? "no-match";
  const [companionEnabled, setCompanionEnabled] = useState(false);
  const [companionState, setCompanionState] = useState<{
    matchKey: string;
    entries: CompanionHistoryEntry[];
  }>({
    matchKey,
    entries: [],
  });

  const companionHistory = useMemo(
    () => (companionState.matchKey === matchKey ? companionState.entries : []),
    [companionState.entries, companionState.matchKey, matchKey],
  );

  const companionSuggestion = useMemo<CompanionSuggestion | null>(
    () =>
      buildCompanionSuggestion({
        enabled: companionEnabled,
        match,
        playerSlot,
        selectedCell,
        visibilityReport,
        history: companionHistory,
      }),
    [companionEnabled, companionHistory, match, playerSlot, selectedCell, visibilityReport],
  );

  const recordCompanionHistory = useCallback(
    (
      order: OrderParams,
      source?: Pick<CompanionSuggestion, "reasonKey" | "memoryKey"> | null,
    ) => {
      setCompanionState((current) => {
        const currentEntries =
          current.matchKey === matchKey ? current.entries : [];
        const nextEntry = createCompanionHistoryEntry(order, source);
        return {
          matchKey,
          entries: [nextEntry, ...currentEntries].slice(0, 3),
        };
      });
    },
    [matchKey],
  );

  return {
    companionEnabled,
    setCompanionEnabled,
    companionSuggestion,
    recordCompanionHistory,
  };
}
