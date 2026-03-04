"use client";

import { PublicKey } from "@solana/web3.js";
import { MatchStatus, NO_WINNER, type GalaxyMatch } from "@sdk";

interface TurnStatusProps {
  match: GalaxyMatch;
  walletKey: PublicKey | null;
}

function statusLabel(status: number): string {
  switch (status) {
    case MatchStatus.WaitingForPlayers:
      return "Waiting for Players";
    case MatchStatus.Active:
      return "Active";
    case MatchStatus.Completed:
      return "Completed";
    default:
      return `Unknown (${status})`;
  }
}

export default function TurnStatus({ match, walletKey }: TurnStatusProps) {
  const winner = match.battleSummary[0];
  const hasWinner = winner !== NO_WINNER;
  const registeredPlayers = match.players.filter(
    (player) => player.toBase58() !== PublicKey.default.toBase58(),
  ).length;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">Turn {match.turn}</h3>
        <span
          className={`px-2 py-1 rounded text-sm font-medium ${
            match.status === MatchStatus.Active
              ? "bg-green-800 text-green-200"
              : match.status === MatchStatus.Completed
                ? "bg-purple-800 text-purple-200"
                : "bg-yellow-800 text-yellow-200"
          }`}
        >
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="text-sm text-gray-400">
        Players: {registeredPlayers} / {match.playerCount}
      </div>

      {match.status === MatchStatus.Active && (
        <div className="flex gap-2">
          {Array.from({ length: match.playerCount }, (_, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                match.submittedOrders[i]
                  ? "bg-green-900 text-green-300"
                  : "bg-gray-800 text-gray-500"
              }`}
            >
              <span>{match.submittedOrders[i] ? "Ready" : "Waiting"}</span>
              <span>
                Player {i + 1}
                {walletKey && match.players[i]?.toBase58() === walletKey.toBase58()
                  ? " (you)"
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasWinner && (
        <div className="text-lg font-bold text-yellow-400">
          Winner: Player {winner + 1}
        </div>
      )}
    </div>
  );
}
