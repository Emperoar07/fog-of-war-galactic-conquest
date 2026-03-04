"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMatch } from "@/hooks/useMatch";
import { useGameClient } from "@/hooks/useGameClient";
import { usePlayerKeys } from "@/hooks/usePlayerKeys";
import ActivityLog, { type ActivityLogEntry } from "@/components/ActivityLog";
import GameBoard from "@/components/GameBoard";
import TurnStatus from "@/components/TurnStatus";
import OrderPanel from "@/components/OrderPanel";
import BattleSummary from "@/components/BattleSummary";
import Toast from "@/components/Toast";
import VisibilityPanel from "@/components/VisibilityPanel";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import {
  advanceDemoTurn,
  buildDemoVisibilityReport,
  DEMO_MODE_ENABLED,
  isDemoMatchId,
  markDemoOrdersSubmitted,
} from "@/lib/demo";
import {
  MatchStatus,
  type DecodedVisibilityReport,
  type OrderParams,
} from "@sdk";

export default function MatchPage() {
  return (
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
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const playerSlot =
    demoMode
      ? 0
      : publicKey && client && match
      ? client.getPlayerSlot(match, publicKey) ?? null
      : null;
  const isPlayer = playerSlot !== null;

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
        : [
            {
              id: "demo-mode",
              message:
                "Running with simulated state. Orders, visibility, and turn resolution are mocked locally.",
              time: "Demo",
              tone: "info",
            },
          ],
    );
  }, [demoMode]);

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
        void refresh();
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
        void refresh();
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
        void refresh();
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

  const summary = client?.parseBattleSummary(match) ?? {
    winner: 255,
    destroyedByPlayer: [0, 0, 0, 0],
    commandFleetAlive: [true, true, true, true],
    nextTurn: 0,
  };

  const handleJoin = async () => {
    if (demoMode) {
      showStatus("Demo crews are already locked in for this showcase.", "info", true);
      return;
    }
    if (!client || !matchPDA || !publicKey) return;
    setActionMessage(null);
    try {
      const emptySlot = match.players.findIndex(
        (p) => p.toBase58() === "11111111111111111111111111111111",
      );
      if (emptySlot < 0) {
        showStatus("No empty slots available.", "error");
        return;
      }
      showStatus(`Joining player slot ${emptySlot + 1}...`, "info", true);
      await client.registerPlayer(matchPDA, emptySlot);
      showStatus(`Joined as Player ${emptySlot + 1}.`, "success", true);
      await refresh();
    } catch (err: unknown) {
      showStatus(
        `Failed to join: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    }
  };

  const handleSubmitOrder = async (order: OrderParams) => {
    if (demoMode) {
      showStatus(
        `Simulating ${order.action === 2 ? "attack" : "maneuver"} from unit ${order.unitSlot + 1}...`,
        "info",
        true,
      );
      updateMatch((current) => markDemoOrdersSubmitted(current));
      appendActivity(
        `Enemy commander mirrors your move toward sector (${order.targetX}, ${order.targetY}).`,
        "info",
      );
      showStatus("Demo orders locked in. Resolve the turn to continue.", "success");
      return;
    }

    if (!client || !matchPDA || playerSlot === null) return;
    setActionMessage(null);
    try {
      const keys = ensureKeys();
      const result = await client.submitOrders(
        matchPDA,
        playerSlot,
        order,
        keys.privateKey,
      );
      showStatus("Order queued. Waiting for MPC computation...", "info", true);
      await client.awaitComputation(result.computationOffset);
      showStatus("Order callback confirmed.", "success");
      appendActivity("Orders accepted for this turn.", "success");
      await refresh();
    } catch (err: unknown) {
      showStatus(
        `Failed to submit order: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    }
  };

  const handleResolveTurn = async () => {
    if (demoMode) {
      showStatus("Resolving simulated turn...", "info", true);
      updateMatch((current) => advanceDemoTurn(current));
      appendActivity("Recon updates and battle results refreshed locally.", "success");
      showStatus("Demo turn resolved.", "success");
      return;
    }

    if (!client || !matchPDA) return;
    setActionMessage(null);
    try {
      const result = await client.resolveTurn(matchPDA);
      showStatus(
        "Turn resolution queued. Waiting for MPC computation...",
        "info",
        true,
      );
      await client.awaitComputation(result.computationOffset);
      showStatus("Turn resolution callback confirmed.", "success");
      appendActivity("Turn resolution completed.", "success");
      await refresh();
    } catch (err: unknown) {
      showStatus(
        `Failed to resolve: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    }
  };

  const handleVisibility = async () => {
    if (demoMode) {
      if (!match) return;
      const report = buildDemoVisibilityReport(match.turn);
      setVisibilityError(null);
      setVisibilityReport(report);
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
    try {
      const keys = ensureKeys();
      const result = await client.requestVisibility(matchPDA, keys.privateKey);
      showStatus(
        "Visibility check queued. Waiting for MPC computation...",
        "info",
        true,
      );
      await client.awaitComputation(result.computationOffset);
      const updatedMatch = await client.fetchMatch(matchPDA);
      const report = await client.decryptLatestVisibility(
        updatedMatch,
        keys.privateKey,
      );
      setVisibilityReport(report);
      showStatus("Visibility report decrypted.", "success");
      appendActivity(
        report.units.length === 0
          ? "Visibility report shows no enemy contact."
          : `Visibility report reveals ${report.units.length} enemy unit(s).`,
        "success",
      );
      await refresh();
    } catch (err: unknown) {
      setVisibilityReport(null);
      setVisibilityError(
        err instanceof Error ? err.message : "Failed to decrypt visibility report",
      );
      showStatus(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
        true,
      );
    }
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
    <div className="space-y-6">
      <Toast
        message={actionTone === "error" ? actionMessage : visibilityError}
        tone="error"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-[family-name:var(--font-vt323)] text-4xl tracking-[0.14em] text-[#00ff41]">
          Match #{matchId?.toString()}
        </h2>
        <button
          onClick={refresh}
          className="border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)]"
        >
          {demoMode ? "Reset Demo" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-2 border border-[#0e2a0e] bg-[#030d03] px-4 py-3 sm:grid-cols-4">
        <div>
          <div className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f]">
            Mode
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#ffb000]">
            {demoMode ? "Demo Channel" : "Live Devnet"}
          </div>
        </div>
        <div>
          <div className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f]">
            Commander
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#00ff41]">
            {isPlayer && playerSlot !== null ? `Player ${playerSlot + 1}` : "Observer"}
          </div>
        </div>
        <div>
          <div className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f]">
            Turn Phase
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#00e5cc]">
            {match.status === MatchStatus.Active ? "Battle Phase" : "Standby"}
          </div>
        </div>
        <div>
          <div className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f]">
            Session Link
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#00aa2a]">
            Secure MPC Uplink
          </div>
        </div>
      </div>

      {demoMode ? (
        <div className="border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-[#00e5cc]">
          Demo mode is active. The battlefield runs on simulated state so you can test the full UI loop without MXE.
        </div>
      ) : (
        <MXEStatusBanner />
      )}
      <TurnStatus match={match} walletKey={publicKey} />

      {actionMessage && (
        <div
          className={`border px-4 py-3 text-[10px] uppercase tracking-[0.16em] ${
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,420px)]">
        <div className="flex justify-center">
          <GameBoard
            revealedSectorOwner={match.revealedSectorOwner}
            selectedCell={selectedCell}
            onCellClick={(x, y) => setSelectedCell({ x, y })}
          />
        </div>

        <div className="space-y-4">
          {canJoin && (
            <button
              onClick={handleJoin}
              className="w-full border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] py-3 text-[10px] uppercase tracking-[0.24em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)]"
            >
              Join Match
            </button>
          )}

          {canSubmitOrders && (
            <OrderPanel
              match={match}
              playerSlot={playerSlot}
              selectedCell={selectedCell}
              onSubmit={handleSubmitOrder}
              disabled={!client}
            />
          )}

          {canResolve && (
            <button
              onClick={handleResolveTurn}
              className="w-full border border-[#996800] bg-[rgba(255,176,0,0.03)] py-3 text-[10px] uppercase tracking-[0.24em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.08)]"
            >
              Resolve Turn
            </button>
          )}

          {isPlayer && match.status === MatchStatus.Active && (
            <button
              onClick={handleVisibility}
              className="w-full border border-[#005f52] bg-[rgba(0,229,204,0.03)] py-3 text-[10px] uppercase tracking-[0.22em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)]"
            >
              Request Visibility Report
            </button>
          )}

          {isPlayer && (
            <VisibilityPanel
              report={visibilityReport}
              loading={decryptingVisibility}
              error={visibilityError}
            />
          )}

          <BattleSummary match={match} summary={summary} />
          <ActivityLog entries={activityLog} />

          <div className="border border-[#0e2a0e] bg-[#030d03] p-4 space-y-2">
            <h3 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#00ff41]">
              PLAYERS
            </h3>
            {match.players.map((p, i) => {
              const isEmpty = p.toBase58() === "11111111111111111111111111111111";
              if (i >= match.playerCount) return null;
              return (
                <div key={i} className="flex justify-between text-xs uppercase tracking-[0.14em]">
                  <span className="text-[#0c6d1f]">
                    Player {i + 1}
                    {publicKey && p.toBase58() === publicKey.toBase58()
                      ? " (you)"
                      : ""}
                  </span>
                  <span className={isEmpty ? "text-[#084010]" : "text-[#00cc33]"}>
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
    </div>
  );
}
