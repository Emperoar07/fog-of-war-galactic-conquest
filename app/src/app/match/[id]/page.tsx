"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMatch } from "@/hooks/useMatch";
import { useGameClient } from "@/hooks/useGameClient";
import { usePlayerKeys } from "@/hooks/usePlayerKeys";
import ActivityLog, { type ActivityLogEntry } from "@/components/ActivityLog";
import GameBoard from "@/components/GameBoard";
import TurnStatus from "@/components/TurnStatus";
import OrderPanel from "@/components/OrderPanel";
import BattleSummary from "@/components/BattleSummary";
import VisibilityPanel from "@/components/VisibilityPanel";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import {
  MatchStatus,
  type DecodedVisibilityReport,
  type OrderParams,
} from "@sdk";

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id ? BigInt(params.id as string) : null;
  const { publicKey } = useWallet();
  const client = useGameClient();
  const { match, matchPDA, loading, error, refresh } = useMatch(matchId);
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
    publicKey && client && match
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
    let cancelled = false;

    async function syncVisibility() {
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
  }, [client, isPlayer, keys, match]);

  useEffect(() => {
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
  }, [appendActivity, client, matchId, playerSlot, refresh, showStatus]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading match {matchId?.toString()}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-red-400">{error}</div>
        <button
          onClick={refresh}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!match || !matchPDA) {
    return (
      <div className="text-center py-12 text-gray-500">
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
    if (!client || !matchPDA || !publicKey) return;
    setActionMessage(null);
    try {
      // Find first empty slot
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
    match.status === MatchStatus.WaitingForPlayers && !isPlayer && publicKey;
  const canSubmitOrders =
    match.status === MatchStatus.Active && isPlayer && playerSlot !== null;
  const canResolve =
    match.status === MatchStatus.Active && client?.allOrdersSubmitted(match);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">
          Match #{matchId?.toString()}
        </h2>
        <button
          onClick={refresh}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
        >
          Refresh
        </button>
      </div>

      <MXEStatusBanner />
      <TurnStatus match={match} walletKey={publicKey} />

      {actionMessage && (
        <div
          className={`px-4 py-2 rounded text-sm border ${
            actionTone === "success"
              ? "bg-green-950 border-green-800 text-green-300"
              : actionTone === "error"
                ? "bg-red-950 border-red-800 text-red-300"
                : "bg-gray-800 border-gray-600 text-gray-300"
          }`}
        >
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Game board */}
        <div className="lg:col-span-2 flex justify-center">
          <GameBoard
            revealedSectorOwner={match.revealedSectorOwner}
            selectedCell={selectedCell}
            onCellClick={(x, y) => setSelectedCell({ x, y })}
          />
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Join button */}
          {canJoin && (
            <button
              onClick={handleJoin}
              className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-3 rounded transition-colors"
            >
              Join Match
            </button>
          )}

          {/* Order panel */}
          {canSubmitOrders && (
            <OrderPanel
              match={match}
              playerSlot={playerSlot}
              selectedCell={selectedCell}
              onSubmit={handleSubmitOrder}
              disabled={!client}
            />
          )}

          {/* Resolve button */}
          {canResolve && (
            <button
              onClick={handleResolveTurn}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white font-medium py-3 rounded transition-colors"
            >
              Resolve Turn
            </button>
          )}

          {/* Visibility button */}
          {isPlayer && match.status === MatchStatus.Active && (
            <button
              onClick={handleVisibility}
              className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-medium py-2 rounded transition-colors text-sm"
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

          {/* Player info */}
          <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-2">
            <h3 className="text-lg font-bold text-white">Players</h3>
            {match.players.map((p, i) => {
              const isEmpty = p.toBase58() === "11111111111111111111111111111111";
              if (i >= match.playerCount) return null;
              return (
                <div key={i} className="text-sm flex justify-between">
                  <span className="text-gray-400">
                    Player {i + 1}
                    {publicKey && p.toBase58() === publicKey.toBase58()
                      ? " (you)"
                      : ""}
                  </span>
                  <span className={isEmpty ? "text-gray-600" : "text-white"}>
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
