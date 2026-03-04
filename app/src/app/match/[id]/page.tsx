"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMatch } from "@/hooks/useMatch";
import { useGameClient } from "@/hooks/useGameClient";
import { usePlayerKeys } from "@/hooks/usePlayerKeys";
import { useSound } from "@/components/SoundProvider";
import GameBoard from "@/components/GameBoard";
import Toast from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import TurnTimer from "@/components/TurnTimer";
import { trackEvent } from "@/lib/analytics";
import {
  advanceDemoTurn,
  buildDemoVisibilityReport,
  DEMO_MODE_ENABLED,
  getDemoUnitPositions,
  isDemoMatchId,
  markDemoOpponentSubmitted,
  markDemoOrdersSubmitted,
  saveDemoSnapshot,
  type DemoSnapshot,
} from "@/lib/demo";
import {
  MatchStatus,
  OrderAction,
  type DecodedVisibilityReport,
  type OrderParams,
} from "@sdk";

// Re-export type for dynamic imports
export type ActivityLogEntry = {
  id: string;
  message: string;
  time: string;
  tone: "info" | "success" | "error";
};

type CompanionSuggestion = {
  order: OrderParams;
  title: string;
  reason: string;
  reasonKey: string;
  memoryKey: string;
};

type CompanionHistoryEntry = {
  unitSlot: number;
  action: OrderAction;
  targetX: number;
  targetY: number;
  reasonKey: string;
  memoryKey: string;
};

type CompanionCandidate = CompanionSuggestion & {
  score: number;
};

function buildInitialDemoActivity(): ActivityLogEntry[] {
  return [
    {
      id: "demo-mode",
      message:
        "Running with simulated state. Orders, visibility, and turn resolution are mocked locally.",
      time: "Demo",
      tone: "info",
    },
  ];
}

// Lazy-load side panel components
const TurnStatus = dynamic(() => import("@/components/TurnStatus"), {
  ssr: false,
  loading: () => <div className="h-16 animate-pulse border border-[#0e2a0e] bg-[#030d03]" />,
});
const OrderPanel = dynamic(() => import("@/components/OrderPanel"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse border border-[#0e2a0e] bg-[#030d03]" />,
});
const BattleSummary = dynamic(() => import("@/components/BattleSummary"), {
  ssr: false,
  loading: () => <div className="h-20 animate-pulse border border-[#0e2a0e] bg-[#030d03]" />,
});
const ActivityLog = dynamic(() => import("@/components/ActivityLog"), {
  ssr: false,
  loading: () => <div className="h-16 animate-pulse border border-[#0e2a0e] bg-[#030d03]" />,
});
const VisibilityPanel = dynamic(() => import("@/components/VisibilityPanel"), {
  ssr: false,
});
const MXEStatusBanner = dynamic(() => import("@/components/MXEStatusBanner"), {
  ssr: false,
});
const TutorialOverlay = dynamic(() => import("@/components/TutorialOverlay"), {
  ssr: false,
});
const DemoReplay = dynamic(() => import("@/components/DemoReplay"), {
  ssr: false,
});

export default function MatchPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 py-16 text-center text-[#0c6d1f]">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#0e2a0e] border-t-[#00ff41]" />
            <span>Loading...</span>
          </div>
        }
      >
        <MatchPageInner />
      </Suspense>
    </ErrorBoundary>
  );
}

function MatchPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.id ? BigInt(params.id as string) : null;
  const demoMode =
    searchParams.get("demo") === "1" ||
    (DEMO_MODE_ENABLED && isDemoMatchId(matchId));
  const { publicKey } = useWallet();
  const client = useGameClient();
  const { playSound } = useSound();
  const { match, matchPDA, loading, error, refresh, updateMatch } = useMatch(
    matchId,
    demoMode,
  );
  const { keys, ensureKeys } = usePlayerKeys();
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"info" | "success" | "error">("info");
  const [visibilityReport, setVisibilityReport] =
    useState<DecodedVisibilityReport | null>(null);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [decryptingVisibility, setDecryptingVisibility] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    null | "join" | "orders" | "resolve" | "visibility" | "refresh"
  >(null);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [tutorialHighlight, setTutorialHighlight] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [winnerOverlayVisible, setWinnerOverlayVisible] = useState(false);
  const [lastWinnerKey, setLastWinnerKey] = useState<string | null>(null);
  const [companionEnabled, setCompanionEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("fog-of-war-companion-enabled") !== "0";
  });
  const [companionHistory, setCompanionHistory] = useState<CompanionHistoryEntry[]>([]);
  const [orderPrefill, setOrderPrefill] = useState<OrderParams | null>(null);
  const [orderPrefillNonce, setOrderPrefillNonce] = useState(0);
  const demoOpponentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerSlot =
    demoMode
      ? 0
      : publicKey && client && match
      ? client.getPlayerSlot(match, publicKey) ?? null
      : null;
  const isPlayer = playerSlot !== null;
  const isBusy = pendingAction !== null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "fog-of-war-companion-enabled",
      companionEnabled ? "1" : "0",
    );
  }, [companionEnabled]);

  useEffect(() => {
    return () => {
      if (demoOpponentTimeoutRef.current) {
        clearTimeout(demoOpponentTimeoutRef.current);
      }
    };
  }, []);

  // Analytics: track match view
  useEffect(() => {
    trackEvent("matchesViewed");
    if (demoMode) trackEvent("demoStarts");
  }, [demoMode]);

  // Demo unit positions (memoized per turn)
  const demoUnitPositions = useMemo(
    () => (demoMode && match ? getDemoUnitPositions(match.turn) : []),
    [demoMode, match],
  );

  // Visibility-derived unit positions for live mode
  const visibilityUnits = useMemo(() => {
    if (!visibilityReport) return [];
    return visibilityReport.units.map((u) => ({
      slot: u.slot,
      x: u.x,
      y: u.y,
    }));
  }, [visibilityReport]);

  // Save demo snapshots for replay
  useEffect(() => {
    if (demoMode && match) {
      saveDemoSnapshot(match);
    }
  }, [demoMode, match]);

  useEffect(() => {
    setCompanionHistory([]);
  }, [matchId]);

  const summary = useMemo(
    () =>
      match
        ? client?.parseBattleSummary(match) ?? {
            winner: 255,
            destroyedByPlayer: [0, 0, 0, 0],
            commandFleetAlive: [true, true, true, true],
            nextTurn: 0,
          }
        : null,
    [client, match],
  );

  const companionSuggestion = useMemo<CompanionSuggestion | null>(() => {
    if (
      !companionEnabled ||
      !match ||
      playerSlot === null ||
      match.status !== MatchStatus.Active
    ) {
      return null;
    }

    const size = Math.sqrt(match.revealedSectorOwner.length) || 1;
    const center = (size - 1) / 2;
    const tiles = match.revealedSectorOwner.map((owner, index) => {
      const x = index % size;
      const y = Math.floor(index / size);
      const score = Math.abs(x - center) + Math.abs(y - center);
      return { owner, x, y, score };
    });
    const candidates: CompanionCandidate[] = [];

    const addCandidate = (
      order: OrderParams,
      title: string,
      reason: string,
      reasonKey: string,
      baseScore: number,
    ) => {
      const memoryKey = `${order.unitSlot}-${order.action}-${order.targetX}-${order.targetY}-${reasonKey}`;
      let score = baseScore;

      for (const entry of companionHistory) {
        if (entry.action === order.action) score -= 5;
        if (entry.unitSlot === order.unitSlot) score -= 3;
        if (entry.targetX === order.targetX && entry.targetY === order.targetY) score -= 10;
        if (entry.reasonKey === reasonKey) score -= 7;
        if (entry.memoryKey === memoryKey) score -= 14;
      }

      candidates.push({
        order,
        title,
        reason,
        reasonKey,
        memoryKey,
        score,
      });
    };

    const threatNearCommand = tiles.some(
      (tile) =>
        (tile.owner === 2 || tile.owner === 3 || tile.owner === 4) &&
        tile.x <= 2 &&
        tile.y <= 2,
    );

    if (visibilityReport && visibilityReport.units.length > 0) {
      for (const target of visibilityReport.units.slice(0, 2)) {
        const distanceFromCenter =
          Math.abs(target.x - center) + Math.abs(target.y - center);
        addCandidate(
          {
            unitSlot: 2,
            action: OrderAction.Attack,
            targetX: target.x,
            targetY: target.y,
          },
          `Attack sector (${target.x}, ${target.y})`,
          "Attack the clearest hostile contact before it can reposition.",
          "attack-visible",
          96 - distanceFromCenter * 3,
        );
      }
    }

    if (threatNearCommand) {
      const fallbackTile =
        tiles
          .filter((tile) => tile.owner === 1)
          .sort((a, b) => a.score - b.score)[0] ?? { x: 1, y: 1, score: 0 };
      addCandidate(
        {
          unitSlot: 2,
          action: OrderAction.Move,
          targetX: fallbackTile.x,
          targetY: fallbackTile.y,
        },
        `Reposition command to (${fallbackTile.x}, ${fallbackTile.y})`,
        "Enemy pressure is near your base, so preserving the command fleet takes priority.",
        "protect-command",
        82,
      );
    }

    for (const contested of tiles
      .filter((tile) => tile.owner === 3)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)) {
      addCandidate(
        {
          unitSlot: 1,
          action: OrderAction.Scout,
          targetX: contested.x,
          targetY: contested.y,
        },
        `Scout sector (${contested.x}, ${contested.y})`,
        "Scout the contested center to expand vision before committing heavier units.",
        "scout-contested",
        76 - contested.score * 4,
      );
    }

    for (const neutral of tiles
      .filter((tile) => tile.owner === 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)) {
      addCandidate(
        {
          unitSlot: 0,
          action: OrderAction.Move,
          targetX: neutral.x,
          targetY: neutral.y,
        },
        `Advance to sector (${neutral.x}, ${neutral.y})`,
        "Advance into open space to improve board control without overextending.",
        "expand-neutral",
        62 - neutral.score * 3,
      );
    }

    if (selectedCell) {
      addCandidate(
        {
          unitSlot: 1,
          action: OrderAction.Scout,
          targetX: selectedCell.x,
          targetY: selectedCell.y,
        },
        `Probe sector (${selectedCell.x}, ${selectedCell.y})`,
        "Your selected sector is a good probe point if you want to test this lane next.",
        "probe-selected",
        58,
      );
    }

    if (candidates.length === 0) {
      addCandidate(
        {
          unitSlot: 1,
          action: OrderAction.Scout,
          targetX: 0,
          targetY: 0,
        },
        "Scout sector (0, 0)",
        "No strong signal is visible, so a cautious scout keeps the initiative without overcommitting.",
        "fallback-scout",
        48,
      );
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return best
      ? {
          order: best.order,
          title: best.title,
          reason: best.reason,
          reasonKey: best.reasonKey,
          memoryKey: best.memoryKey,
        }
      : null;
  }, [
    companionEnabled,
    companionHistory,
    match,
    playerSlot,
    selectedCell,
    visibilityReport,
  ]);

  const appendActivity = useCallback(
    (message: string, tone: "info" | "success" | "error" = "info") => {
      const entry: ActivityLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        tone,
      };
      setActivityLog((current) => [entry, ...current].slice(0, 8));
    },
    [],
  );

  const showStatus = useCallback(
    (
      message: string,
      tone: "info" | "success" | "error" = "info",
      log = false,
    ) => {
      setActionMessage(message);
      setActionTone(tone);
      if (log) {
        appendActivity(message, tone);
      }
    },
    [appendActivity],
  );

  const recordCompanionHistory = useCallback(
    (
      order: OrderParams,
      source?: Pick<CompanionSuggestion, "reasonKey" | "memoryKey"> | null,
    ) => {
      setCompanionHistory((current) => {
        const nextEntry: CompanionHistoryEntry = {
          unitSlot: order.unitSlot,
          action: order.action,
          targetX: order.targetX,
          targetY: order.targetY,
          reasonKey: source?.reasonKey ?? "manual-order",
          memoryKey:
            source?.memoryKey ??
            `${order.unitSlot}-${order.action}-${order.targetX}-${order.targetY}-manual-order`,
        };
        return [nextEntry, ...current].slice(0, 3);
      });
    },
    [],
  );

  useEffect(() => {
    if (!demoMode) return;
    setActionMessage("Demo mode is active. No MXE or wallet is required.");
    setActionTone("info");
    setActivityLog((current) =>
      current.length > 0
        ? current
        : buildInitialDemoActivity(),
    );
  }, [demoMode]);

  useEffect(() => {
    if (!summary || summary.winner === 255 || matchId === null || !match) return;

    const winnerKey = `${matchId.toString()}-${summary.winner}-${match.turn}`;
    if (winnerKey === lastWinnerKey) return;

    setLastWinnerKey(winnerKey);
    setWinnerOverlayVisible(true);
    playSound("victory");
    appendActivity(`Victory confirmed for Player ${summary.winner + 1}.`, "success");
  }, [appendActivity, lastWinnerKey, match, matchId, playSound, summary]);

  useEffect(() => {
    let cancelled = false;

    async function syncVisibility() {
      if (demoMode) return;
      if (!client || !match || !keys || !isPlayer) {
        if (!cancelled) {
          setVisibilityReport(null);
          setVisibilityError(null);
          setDecryptingVisibility(false);
        }
        return;
      }

      if (match.lastVisibilityNonce.isZero()) {
        if (!cancelled) {
          setVisibilityReport(null);
          setVisibilityError(null);
          setDecryptingVisibility(false);
        }
        return;
      }

      try {
        if (!cancelled) {
          setDecryptingVisibility(true);
          setVisibilityError(null);
        }
        const report = await client.decryptLatestVisibility(match, keys.privateKey);
        if (!cancelled) {
          setVisibilityReport(report);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setVisibilityReport(null);
          setVisibilityError(
            err instanceof Error
              ? err.message
              : "Failed to decrypt visibility report",
          );
        }
      } finally {
        if (!cancelled) {
          setDecryptingVisibility(false);
        }
      }
    }

    syncVisibility();

    return () => {
      cancelled = true;
    };
  }, [client, demoMode, isPlayer, keys, match]);

  useEffect(() => {
    if (demoMode) return;
    if (!client || matchId === null) return;

    const matchIdText = matchId.toString();
    const listeners = [
      client.onMatchReady((event) => {
        if (event.matchId.toString() !== matchIdText) return;
        showStatus("Match initialization callback completed.", "success");
        appendActivity(
          `Match ready for ${event.playerCount} players.`,
          "success",
        );
      }),
      client.onTurnResolved((event) => {
        if (event.matchId.toString() !== matchIdText) return;
        const winnerText =
          event.winner === 255
            ? "No winner yet."
            : `Player ${event.winner + 1} now leads the board.`;
        showStatus("Turn resolution callback completed.", "success");
        appendActivity(
          `Turn ${event.nextTurn} is live. ${winnerText}`,
          "success",
        );
      }),
      client.onVisibilityReady((event) => {
        if (event.matchId.toString() !== matchIdText) return;
        const suffix =
          playerSlot !== null && event.viewerIndex === playerSlot
            ? " Your latest visibility report is ready."
            : "";
        showStatus("Visibility callback completed.", "success");
        appendActivity(
          `Visibility snapshot finalized for player ${event.viewerIndex + 1}.${suffix}`,
          "success",
        );
      }),
    ];

    return () => {
      for (const id of listeners) {
        void client.removeListener(id);
      }
    };
  }, [appendActivity, client, demoMode, matchId, playerSlot, refresh, showStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-[#0c6d1f]">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-[#0e2a0e] border-t-[#00ff41]" />
        <span>Loading match {matchId?.toString()}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-[#ff3333]">{error}</div>
        <button
          onClick={refresh}
          className="border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00ff41]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!match || !matchPDA) {
    return (
      <div className="text-center py-12 text-[#0c6d1f]">
        Match not found
      </div>
    );
  }

  const resolvedSummary = summary ?? {
    winner: 255,
    destroyedByPlayer: [0, 0, 0, 0],
    commandFleetAlive: [true, true, true, true],
    nextTurn: 0,
  };

  const handleShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      playSound("uiTap");
      setTimeout(() => setShareToast(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const handleApplyCompanionSuggestion = () => {
    if (!companionSuggestion) return;
    setOrderPrefill(companionSuggestion.order);
    setOrderPrefillNonce((current) => current + 1);
    setSelectedCell({
      x: companionSuggestion.order.targetX,
      y: companionSuggestion.order.targetY,
    });
    playSound("uiTap");
    showStatus("Companion suggestion loaded into fire control.", "info", true);
  };

  const handleJoin = async () => {
    if (demoMode) {
      playSound("uiTap");
      showStatus("Demo crews are already locked in for this showcase.", "info", true);
      return;
    }
    if (!client || !matchPDA || !publicKey) return;
    setActionMessage(null);
    setPendingAction("join");
    try {
      const emptySlot = match.players.findIndex(
        (p) => p.toBase58() === "11111111111111111111111111111111",
      );
      if (emptySlot < 0) {
        playSound("error");
        showStatus("No empty slots available.", "error");
        return;
      }
      showStatus(`Joining player slot ${emptySlot + 1}...`, "info", true);
      playSound("uplink");
      await client.registerPlayer(matchPDA, emptySlot);
      updateMatch((current) => {
        const players = [...current.players];
        players[emptySlot] = publicKey;
        return { ...current, players };
      });
      playSound("success");
      showStatus(`Joined as Player ${emptySlot + 1}.`, "success", true);
    } catch (err: unknown) {
      playSound("error");
      showStatus(
        `Failed to join: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleSubmitOrder = async (order: OrderParams) => {
    const matchedSuggestion =
      companionSuggestion &&
      companionSuggestion.order.unitSlot === order.unitSlot &&
      companionSuggestion.order.action === order.action &&
      companionSuggestion.order.targetX === order.targetX &&
      companionSuggestion.order.targetY === order.targetY
        ? companionSuggestion
        : null;

    if (demoMode) {
      if (demoOpponentTimeoutRef.current) {
        clearTimeout(demoOpponentTimeoutRef.current);
      }
      playSound("uplink");
      showStatus(
        `Simulating ${order.action === 2 ? "attack" : "maneuver"} from unit ${order.unitSlot + 1}...`,
        "info",
        true,
      );
      updateMatch((current) =>
        markDemoOrdersSubmitted(current, {
          targetX: order.targetX,
          targetY: order.targetY,
          action: order.action,
        }),
      );
      recordCompanionHistory(order, matchedSuggestion);
      appendActivity(
        `Your order is staged for sector (${order.targetX}, ${order.targetY}).`,
        "info",
      );
      trackEvent("ordersSubmitted");
      playSound("success");
      showStatus(
        "Order queued. Demo AI is locking in. You can still replace this order before resolve.",
        "success",
      );
      demoOpponentTimeoutRef.current = setTimeout(() => {
        updateMatch((current) => markDemoOpponentSubmitted(current));
        appendActivity("Enemy commander has locked in a response.", "success");
        playSound("success");
        showStatus("Both orders are locked. Resolve the turn when ready.", "success");
        demoOpponentTimeoutRef.current = null;
      }, 900);
      return;
    }

    if (!client || !matchPDA || playerSlot === null) return;
    setActionMessage(null);
    setPendingAction("orders");
    try {
      const keys = ensureKeys();
      playSound("uplink");
      const result = await client.submitOrders(
        matchPDA,
        playerSlot,
        order,
        keys.privateKey,
      );
      recordCompanionHistory(order, matchedSuggestion);
      showStatus("Order queued. Waiting for MPC computation...", "info", true);
      await client.awaitComputation(result.computationOffset);
      trackEvent("ordersSubmitted");
      playSound("success");
      showStatus("Order callback confirmed.", "success");
      appendActivity("Orders accepted for this turn.", "success");
    } catch (err: unknown) {
      playSound("error");
      showStatus(
        `Failed to submit order: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleResolveTurn = async () => {
    if (demoMode) {
      if (demoOpponentTimeoutRef.current) {
        clearTimeout(demoOpponentTimeoutRef.current);
        demoOpponentTimeoutRef.current = null;
      }
      playSound("resolve");
      showStatus("Resolving simulated turn...", "info", true);
      updateMatch((current) => advanceDemoTurn(current));
      trackEvent("turnsPlayed");
      appendActivity("Recon updates and battle results refreshed locally.", "success");
      showStatus("Demo turn resolved.", "success");
      return;
    }

    if (!client || !matchPDA) return;
    setActionMessage(null);
    setPendingAction("resolve");
    try {
      playSound("resolve");
      const result = await client.resolveTurn(matchPDA);
      showStatus(
        "Turn resolution queued. Waiting for MPC computation...",
        "info",
        true,
      );
      await client.awaitComputation(result.computationOffset);
      trackEvent("turnsPlayed");
      playSound("success");
      showStatus("Turn resolution callback confirmed.", "success");
      appendActivity("Turn resolution completed.", "success");
    } catch (err: unknown) {
      playSound("error");
      showStatus(
        `Failed to resolve: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleVisibility = async () => {
    if (demoMode) {
      if (!match) return;
      playSound("reveal");
      const report = buildDemoVisibilityReport(match.turn);
      setVisibilityError(null);
      setVisibilityReport(report);
      trackEvent("visibilityRequests");
      showStatus("Simulated scout report generated.", "success", true);
      appendActivity(
        `Scout drones tagged ${report.units.length} hostile contact(s).`,
        "success",
      );
      return;
    }

    if (!client || !matchPDA) return;
    setActionMessage(null);
    setVisibilityError(null);
    setPendingAction("visibility");
    try {
      const keys = ensureKeys();
      playSound("reveal");
      const result = await client.requestVisibility(matchPDA, keys.privateKey);
      showStatus(
        "Visibility check queued. Waiting for MPC computation...",
        "info",
        true,
      );
      await client.awaitComputation(result.computationOffset);
      const updatedMatch = await refresh();
      if (!updatedMatch) {
        throw new Error("Visibility report is not available yet.");
      }
      const report = await client.decryptLatestVisibility(
        updatedMatch,
        keys.privateKey,
      );
      setVisibilityReport(report);
      trackEvent("visibilityRequests");
      playSound("success");
      showStatus("Visibility report decrypted.", "success");
      appendActivity(
        report.units.length === 0
          ? "Visibility report shows no enemy contact."
          : `Visibility report reveals ${report.units.length} enemy unit(s).`,
        "success",
      );
    } catch (err: unknown) {
      setVisibilityReport(null);
      setVisibilityError(
        err instanceof Error ? err.message : "Failed to decrypt visibility report",
      );
      playSound("error");
      showStatus(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleRefresh = async () => {
    setPendingAction("refresh");
    try {
      if (demoOpponentTimeoutRef.current) {
        clearTimeout(demoOpponentTimeoutRef.current);
        demoOpponentTimeoutRef.current = null;
      }
      await refresh();
      if (demoMode) {
        setSelectedCell(null);
        setOrderPrefill(null);
        setVisibilityReport(null);
        setVisibilityError(null);
        setDecryptingVisibility(false);
        setActionMessage("Demo mode is active. No MXE or wallet is required.");
        setActionTone("info");
        setActivityLog(buildInitialDemoActivity());
        setWinnerOverlayVisible(false);
        setLastWinnerKey(null);
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleReplaySnapshot = (snapshot: DemoSnapshot) => {
    playSound("uiTap");
    updateMatch((current) => ({
      ...current,
      turn: snapshot.turn,
      revealedSectorOwner: snapshot.revealedSectorOwner,
      battleSummary: snapshot.battleSummary,
    }));
    appendActivity(`Replaying archived turn ${snapshot.turn}.`, "info");
  };

  const canJoin =
    !demoMode &&
    match.status === MatchStatus.WaitingForPlayers &&
    !isPlayer &&
    publicKey;
  const canSubmitOrders =
    match.status === MatchStatus.Active && isPlayer && playerSlot !== null;
  const allOrdersReady = match.submittedOrders
    .slice(0, match.playerCount)
    .every((submitted) => submitted !== 0);
  const canResolve =
    match.status === MatchStatus.Active &&
    (demoMode ? allOrdersReady : Boolean(client?.allOrdersSubmitted(match)));

  return (
    <div className="space-y-3 sm:space-y-5">
      <Toast
        message={actionTone === "error" ? actionMessage : visibilityError}
        tone="error"
      />

      {winnerOverlayVisible && resolvedSummary.winner !== 255 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,8,1,0.86)] px-4">
          <div className="w-full max-w-md border border-[#996800] bg-[#030d03] p-4 text-center shadow-[0_0_28px_rgba(255,176,0,0.14)] sm:p-5">
            <div className="border border-[rgba(255,176,0,0.2)] p-4">
              <div className="text-[9px] uppercase tracking-[0.3em] text-[#0c6d1f]">
                Victory Signal
              </div>
              <div className="mt-2 font-[family-name:var(--font-vt323)] text-4xl tracking-[0.16em] text-[#ffb000]">
                Player {resolvedSummary.winner + 1}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#00cc33]">
                The campaign is decided. Command fleet supremacy confirmed.
              </div>
              <button
                onClick={() => setWinnerOverlayVisible(false)}
                className="mt-4 border border-[#996800] bg-[rgba(255,176,0,0.04)] px-5 py-2 text-[10px] uppercase tracking-[0.24em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.08)]"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {shareToast && (
        <div className="fixed top-4 right-4 z-50 border border-[#0c6d1f] bg-[#030d03] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.15)]">
          Link copied to clipboard
        </div>
      )}

      {demoMode && (
        <TutorialOverlay onHighlight={(area) => setTutorialHighlight(area ?? null)} />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 className="font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00ff41] sm:text-4xl">
          Match #{matchId?.toString()}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            data-sound-manual="true"
            onClick={handleShareLink}
            className="w-full border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)] sm:w-auto"
            title="Copy match link to clipboard"
          >
            Share Link
          </button>
          <button
            data-sound-manual="true"
            onClick={handleRefresh}
            disabled={isBusy}
            className="w-full border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)] sm:w-auto"
          >
            {pendingAction === "refresh"
              ? "Syncing..."
              : demoMode
                ? "Reset Demo"
                : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border border-[#0e2a0e] bg-[#030d03] px-2.5 py-2 sm:grid-cols-4 sm:gap-2 sm:px-4 sm:py-3">
        <div>
          <div className="text-[7px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[8px]">
            Mode
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[#ffb000] sm:text-[10px]">
            {demoMode ? "Demo Channel" : "Live Devnet"}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[8px]">
            Commander
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[#00ff41] sm:text-[10px]">
            {isPlayer && playerSlot !== null ? `Player ${playerSlot + 1}` : "Observer"}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[8px]">
            Turn Phase
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[#00e5cc] sm:text-[10px]">
            {match.status === MatchStatus.Active ? "Battle Phase" : "Standby"}
          </div>
        </div>
        <div>
          <div className="text-[7px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[8px]">
            Session Link
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[#00aa2a] sm:text-[10px]">
            Secure MPC Uplink
          </div>
        </div>
      </div>

      {demoMode ? (
        <div className="border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-2.5 py-2 text-[8px] uppercase tracking-[0.14em] text-[#00e5cc] sm:px-4 sm:py-3 sm:text-[10px] sm:tracking-[0.16em]">
          Demo mode is active. The battlefield runs on simulated state so you can test the full UI loop without MXE.
        </div>
      ) : (
        <MXEStatusBanner />
      )}
      <div className="grid grid-cols-1 gap-2 sm:gap-3 xl:grid-cols-[minmax(0,0.4fr)_minmax(240px,0.3fr)_minmax(240px,0.3fr)] xl:items-start">
        <TurnStatus match={match} walletKey={publicKey} />

        <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4 xl:h-[176px]">
          <h3 className="font-[family-name:var(--font-vt323)] text-xl tracking-[0.14em] text-[#00ff41] sm:text-3xl">
            PLAYERS
          </h3>
          <div className="mt-2.5 space-y-2 sm:mt-3 sm:space-y-2.5">
            {match.players.map((p, i) => {
              const isEmpty = p.toBase58() === "11111111111111111111111111111111";
              if (i >= match.playerCount) return null;
              return (
                <div key={i} className="flex justify-between gap-3 text-[9px] uppercase tracking-[0.12em] sm:text-xs sm:tracking-[0.14em]">
                  <span className="text-[#0c6d1f]">
                    Player {i + 1}
                    {publicKey && p.toBase58() === publicKey.toBase58()
                      ? " (you)"
                      : ""}
                  </span>
                  <span className={`text-right ${isEmpty ? "text-[#084010]" : "text-[#00cc33]"}`}>
                    {isEmpty
                      ? "Empty"
                      : `${p.toBase58().slice(0, 4)}...${p.toBase58().slice(-4)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <BattleSummary match={match} summary={resolvedSummary} />
      </div>

      {actionMessage && (
        <div
          className={`border px-3 py-2 text-[9px] uppercase tracking-[0.16em] sm:px-4 sm:py-3 sm:text-[10px] ${
            actionTone === "success"
              ? "bg-[rgba(0,229,204,0.03)] border-[#005f52] text-[#00e5cc]"
              : actionTone === "error"
                ? "bg-[rgba(35,0,0,0.9)] border-[#881111] text-[#ff3333]"
                : "bg-[rgba(0,255,65,0.03)] border-[#0c6d1f] text-[#00ff41]"
          }`}
        >
          {actionMessage}
        </div>
      )}

      <TurnTimer
        key={pendingAction ?? "idle"}
        active={pendingAction === "orders" || pendingAction === "resolve" || pendingAction === "visibility"}
        label={
          pendingAction === "orders"
            ? "Submitting Encrypted Orders"
            : pendingAction === "resolve"
              ? "Resolving Turn"
              : pendingAction === "visibility"
                ? "Requesting Visibility"
                : "Uplink Active"
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,420px)] xl:items-start">
        <div className="flex justify-center self-start">
          <GameBoard
            revealedSectorOwner={match.revealedSectorOwner}
            selectedCell={selectedCell}
            onCellClick={(x, y) => setSelectedCell({ x, y })}
            highlightBoard={tutorialHighlight === "board"}
            unitPositions={demoMode ? demoUnitPositions : visibilityUnits}
          />
        </div>

        <div className="space-y-2.5 sm:space-y-4">
          {canSubmitOrders && (
            <div className="border border-[#0e2a0e] bg-[#030d03] p-2.5 sm:p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[9px]">
                    Companion Mode
                  </div>
                  <div className="mt-1 font-[family-name:var(--font-vt323)] text-xl tracking-[0.12em] text-[#00e5cc] sm:text-2xl">
                    Tactical Assistant
                  </div>
                </div>
                <button
                  data-sound-manual="true"
                  onClick={() => setCompanionEnabled((current) => !current)}
                  className={`border px-2.5 py-1 text-[8px] uppercase tracking-[0.2em] sm:px-3 sm:py-1.5 sm:text-[9px] ${
                    companionEnabled
                      ? "border-[#005f52] bg-[rgba(0,229,204,0.03)] text-[#00e5cc]"
                      : "border-[#0e2a0e] bg-[#021202] text-[#0c6d1f]"
                  }`}
                >
                  {companionEnabled ? "Companion On" : "Companion Off"}
                </button>
              </div>

              <div className="mt-2.5 border border-[#0e2a0e] bg-[#021202] px-2.5 py-2.5 sm:px-3 sm:py-3">
                {companionEnabled && companionSuggestion ? (
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-[8px] uppercase tracking-[0.24em] text-[#ffb000] sm:text-[9px]">
                        Recommended Move
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#00ff41] sm:text-[11px]">
                        {companionSuggestion.title}
                      </div>
                    </div>
                    <div className="text-[11px] leading-5 text-[#00cc33] sm:text-xs sm:leading-6">
                      {companionSuggestion.reason}
                    </div>
                    <button
                      data-sound-manual="true"
                      onClick={handleApplyCompanionSuggestion}
                      disabled={isBusy}
                      className="w-full border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)] disabled:opacity-40"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] leading-5 text-[#0c6d1f] sm:text-xs sm:leading-6">
                    Companion Mode is off. Turn it on when you want a tactical recommendation. It will not suggest or apply moves until you enable it.
                  </div>
                )}
              </div>
            </div>
          )}

          {canJoin && (
            <button
              data-sound-manual="true"
              onClick={handleJoin}
              disabled={isBusy}
              className="w-full border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] py-3 text-[10px] uppercase tracking-[0.24em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)]"
            >
              {pendingAction === "join" ? "Joining..." : "Join Match"}
            </button>
          )}

          {canSubmitOrders && (
            <div className={tutorialHighlight === "orders" ? "ring-1 ring-[#ffb000] ring-offset-1 ring-offset-[#010801]" : ""}>
              <OrderPanel
                match={match}
                playerSlot={playerSlot}
                selectedCell={selectedCell}
                allowReplaceSubmitted={demoMode}
                showResolve
                resolveDisabled={isBusy || !canResolve}
                resolveLabel={
                  pendingAction === "resolve"
                    ? "Resolving..."
                    : canResolve
                      ? "Resolve Turn"
                      : "Ready After Both Orders Lock"
                }
                onResolve={handleResolveTurn}
                showVisibility={isPlayer && match.status === MatchStatus.Active}
                visibilityDisabled={isBusy}
                visibilityLabel={
                  pendingAction === "visibility"
                    ? "Requesting Visibility..."
                    : "Request Visibility Report"
                }
                onVisibility={handleVisibility}
                highlightResolve={tutorialHighlight === "resolve"}
                highlightVisibility={tutorialHighlight === "visibility"}
                prefillOrder={orderPrefill}
                prefillNonce={orderPrefillNonce}
                onSubmit={handleSubmitOrder}
                disabled={isBusy || (!demoMode && !client)}
              />
            </div>
          )}

          {isPlayer && (
            <VisibilityPanel
              report={visibilityReport}
              loading={decryptingVisibility}
              error={visibilityError}
            />
          )}

          <ActivityLog entries={activityLog} />

          {demoMode && (
            <DemoReplay onApplySnapshot={handleReplaySnapshot} />
          )}
        </div>
      </div>
    </div>
  );
}
