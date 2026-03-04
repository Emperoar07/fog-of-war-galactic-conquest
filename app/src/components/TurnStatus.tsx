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
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">Turn {match.turn}</h3>
        <span
          className={`px-2 py-1 rounded text-sm font-medium ${
            match.status === MatchStatus.Active
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : match.status === MatchStatus.Completed
                ? "bg-purple-50 text-purple-700 border border-purple-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="text-sm text-slate-500">
        Players: {registeredPlayers} / {match.playerCount}
      </div>

      {match.status === MatchStatus.Active && (
        <div className="flex gap-2">
          {Array.from({ length: match.playerCount }, (_, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                match.submittedOrders[i]
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-50 text-slate-400 border border-slate-200"
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
        <div className="text-lg font-bold text-amber-600">
          Winner: Player {winner + 1}
        </div>
      )}
    </div>
  );
}
