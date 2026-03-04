"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMatch } from "@/hooks/useMatch";
import { useGameClient } from "@/hooks/useGameClient";
import { usePlayerKeys } from "@/hooks/usePlayerKeys";
import GameBoard from "@/components/GameBoard";
import TurnStatus from "@/components/TurnStatus";
import OrderPanel from "@/components/OrderPanel";
import BattleSummary from "@/components/BattleSummary";
import MXEStatusBanner from "@/components/MXEStatusBanner";
import { MatchStatus, type OrderParams } from "@sdk";

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id ? BigInt(params.id as string) : null;
  const { publicKey } = useWallet();
  const client = useGameClient();
  const { match, matchPDA, loading, error, refresh } = useMatch(matchId);
  const { ensureKeys } = usePlayerKeys();
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const playerSlot = publicKey ? client?.getPlayerSlot(match, publicKey) ?? null : null;
  const isPlayer = playerSlot !== null;
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
        setActionMessage("No empty slots available");
        return;
      }
      await client.registerPlayer(matchPDA, emptySlot);
      setActionMessage(`Joined as Player ${emptySlot + 1}!`);
      refresh();
    } catch (err: unknown) {
      setActionMessage(
        `Failed to join: ${err instanceof Error ? err.message : "Unknown error"}`,
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
      setActionMessage("Order queued. Waiting for MPC computation...");
      await client.awaitComputation(result.computationOffset);
      setActionMessage("Order submitted!");
      await refresh();
    } catch (err: unknown) {
      setActionMessage(
        `Failed to submit order: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleResolveTurn = async () => {
    if (!client || !matchPDA) return;
    setActionMessage(null);
    try {
      const result = await client.resolveTurn(matchPDA);
      setActionMessage("Turn resolution queued. Waiting for MPC computation...");
      await client.awaitComputation(result.computationOffset);
      setActionMessage("Turn resolved.");
      await refresh();
    } catch (err: unknown) {
      setActionMessage(
        `Failed to resolve: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleVisibility = async () => {
    if (!client || !matchPDA) return;
    setActionMessage(null);
    try {
      const keys = ensureKeys();
      const result = await client.requestVisibility(matchPDA, keys.privateKey);
      setActionMessage("Visibility check queued. Waiting for MPC computation...");
      await client.awaitComputation(result.computationOffset);
      setActionMessage("Visibility report updated.");
      await refresh();
    } catch (err: unknown) {
      setActionMessage(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
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
        <div className="bg-gray-800 border border-gray-600 text-gray-300 px-4 py-2 rounded text-sm">
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

          <BattleSummary match={match} summary={summary} />

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
