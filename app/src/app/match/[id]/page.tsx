"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
  const [orderPrefill, setOrderPrefill] = useState<OrderParams | null>(null);
  const [orderPrefillNonce, setOrderPrefillNonce] = useState(0);
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

    if (visibilityReport && visibilityReport.units.length > 0) {
      const target = visibilityReport.units[0];
      return {
        order: {
          unitSlot: 2,
          action: OrderAction.Attack,
          targetX: target.x,
          targetY: target.y,
        },
        title: `Attack sector (${target.x}, ${target.y})`,
        reason:
          "Visible enemy contact is already on your scanners. Strike now before the target moves.",
      };
    }

    const size = Math.sqrt(match.revealedSectorOwner.length) || 1;
    const center = (size - 1) / 2;
    const tiles = match.revealedSectorOwner.map((owner, index) => {
      const x = index % size;
      const y = Math.floor(index / size);
      const score = Math.abs(x - center) + Math.abs(y - center);
      return { owner, x, y, score };
    });

    const contested =
      tiles
        .filter((tile) => tile.owner === 3)
        .sort((a, b) => a.score - b.score)[0] ?? null;
    if (contested) {
      return {
        order: {
          unitSlot: 1,
          action: OrderAction.Scout,
          targetX: contested.x,
          targetY: contested.y,
        },
        title: `Scout sector (${contested.x}, ${contested.y})`,
        reason:
          "A contested sector is the best place to gather intel before committing your attack line.",
      };
    }

    const neutral =
      tiles
        .filter((tile) => tile.owner === 0)
        .sort((a, b) => a.score - b.score)[0] ?? null;
    if (neutral) {
      return {
        order: {
          unitSlot: 0,
          action: OrderAction.Move,
          targetX: neutral.x,
          targetY: neutral.y,
        },
        title: `Advance to sector (${neutral.x}, ${neutral.y})`,
        reason:
          "This route expands your control toward the center without exposing the command fleet too aggressively.",
      };
    }

    const fallback = selectedCell ?? { x: 0, y: 0 };
    return {
      order: {
        unitSlot: 1,
        action: OrderAction.Scout,
        targetX: fallback.x,
        targetY: fallback.y,
      },
      title: `Probe sector (${fallback.x}, ${fallback.y})`,
      reason:
        "No clear public target is available, so a scout action keeps pressure on the board while preserving flexibility.",
    };
  }, [companionEnabled, match, playerSlot, selectedCell, visibilityReport]);

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
    if (demoMode) {
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
      appendActivity(
        `Enemy commander mirrors your move toward sector (${order.targetX}, ${order.targetY}).`,
        "info",
      );
      trackEvent("ordersSubmitted");
      playSound("success");
      showStatus("Demo orders locked in. Resolve the turn to continue.", "success");
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
  const canResolve =
    match.status === MatchStatus.Active && client?.allOrdersSubmitted(match);

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
            onClick={handleShareLink}
            className="w-full border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)] sm:w-auto"
            title="Copy match link to clipboard"
          >
            Share Link
          </button>
          <button
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
      <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(260px,0.3fr)]">
        <TurnStatus match={match} walletKey={publicKey} />

        <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4">
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
            <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[9px]">
                    Companion Mode
                  </div>
                  <div className="mt-1 font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00e5cc] sm:text-3xl">
                    Tactical Assistant
                  </div>
                </div>
                <button
                  onClick={() => setCompanionEnabled((current) => !current)}
                  className={`border px-3 py-1.5 text-[9px] uppercase tracking-[0.22em] sm:text-[10px] ${
                    companionEnabled
                      ? "border-[#005f52] bg-[rgba(0,229,204,0.03)] text-[#00e5cc]"
                      : "border-[#0e2a0e] bg-[#021202] text-[#0c6d1f]"
                  }`}
                >
                  {companionEnabled ? "Companion On" : "Companion Off"}
                </button>
              </div>

              <div className="mt-3 border border-[#0e2a0e] bg-[#021202] px-3 py-3">
                {companionEnabled && companionSuggestion ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-[8px] uppercase tracking-[0.24em] text-[#ffb000] sm:text-[9px]">
                        Recommended Move
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#00ff41] sm:text-xs">
                        {companionSuggestion.title}
                      </div>
                    </div>
                    <div className="text-xs leading-6 text-[#00cc33]">
                      {companionSuggestion.reason}
                    </div>
                    <button
                      onClick={handleApplyCompanionSuggestion}
                      disabled={isBusy}
                      className="w-full border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)] disabled:opacity-40"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                ) : (
                  <div className="text-xs leading-6 text-[#0c6d1f]">
                    Companion Mode is off. Turn it on when you want a tactical recommendation. It will not suggest or apply moves until you enable it.
                  </div>
                )}
              </div>
            </div>
          )}

          {canJoin && (
            <button
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
                prefillOrder={orderPrefill}
                prefillNonce={orderPrefillNonce}
                onSubmit={handleSubmitOrder}
                disabled={!client || isBusy}
              />
            </div>
          )}

          {canResolve && (
            <button
              onClick={handleResolveTurn}
              disabled={isBusy}
              className={`w-full border border-[#996800] bg-[rgba(255,176,0,0.03)] py-3 text-[10px] uppercase tracking-[0.24em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.08)] ${
                tutorialHighlight === "resolve" ? "ring-1 ring-[#ffb000] ring-offset-1 ring-offset-[#010801]" : ""
              }`}
            >
              {pendingAction === "resolve" ? "Resolving..." : "Resolve Turn"}
            </button>
          )}

          {isPlayer && match.status === MatchStatus.Active && (
            <button
              onClick={handleVisibility}
              disabled={isBusy}
              className={`w-full border border-[#005f52] bg-[rgba(0,229,204,0.03)] py-3 text-[10px] uppercase tracking-[0.22em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)] ${
                tutorialHighlight === "visibility" ? "ring-1 ring-[#00e5cc] ring-offset-1 ring-offset-[#010801]" : ""
              }`}
            >
              {pendingAction === "visibility"
                ? "Requesting Visibility..."
                : "Request Visibility Report"}
            </button>
          )}

          {isPlayer && (
            <VisibilityPanel
              report={visibilityReport}
              loading={decryptingVisibility}
              error={visibilityError}
            />
          )}

          <BattleSummary match={match} summary={resolvedSummary} />
          <ActivityLog entries={activityLog} />

          {demoMode && (
            <DemoReplay onApplySnapshot={handleReplaySnapshot} />
          )}
        </div>
      </div>
    </div>
  );
}
