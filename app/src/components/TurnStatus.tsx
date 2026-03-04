"use client";

import { memo } from "react";
import { PublicKey } from "@solana/web3.js";
import { MatchStatus, NO_WINNER, type GalaxyMatch } from "@sdk";

interface TurnStatusProps {
  match: GalaxyMatch;
  walletKey: PublicKey | null;
}

function statusLabel(status: number): string {
  switch (status) {
    case MatchStatus.WaitingForPlayers:
      return "Standby";
    case MatchStatus.Active:
      return "Battle";
    case MatchStatus.Completed:
      return "Complete";
    default:
      return `Unknown (${status})`;
  }
}

export default memo(function TurnStatus({ match, walletKey }: TurnStatusProps) {
  const winner = match.battleSummary[0];
  const hasWinner = winner !== NO_WINNER;
  const registeredPlayers = match.players.filter(
    (player) => player.toBase58() !== PublicKey.default.toBase58(),
  ).length;

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4 xl:h-[176px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <div className="text-[8px] uppercase tracking-[0.3em] text-[#0c6d1f] sm:text-[9px]">
            Turn Status
          </div>
          <h3 className="mt-1 font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#ffb000] sm:text-4xl">
            {String(match.turn).padStart(3, "0")}
          </h3>
        </div>
        <span
          className={`border px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.24em] ${
            match.status === MatchStatus.Active
              ? "border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] text-[#00ff41]"
              : match.status === MatchStatus.Completed
                ? "border-[#005f52] bg-[rgba(0,229,204,0.03)] text-[#00e5cc]"
                : "border-[#996800] bg-[rgba(255,176,0,0.03)] text-[#ffb000]"
          }`}
        >
          {statusLabel(match.status)}
        </span>
      </div>

      <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#0c6d1f] sm:mt-3 sm:text-xs sm:tracking-[0.14em]">
        Registered pilots: {registeredPlayers} / {match.playerCount}
      </div>

      {match.status === MatchStatus.Active && (
        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
          {Array.from({ length: match.playerCount }, (_, i) => (
            <div
              key={i}
              className={`border px-2.5 py-1.5 text-[9px] uppercase tracking-[0.14em] sm:px-3 sm:py-2 sm:text-[10px] sm:tracking-[0.18em] ${
                match.submittedOrders[i]
                  ? "border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] text-[#00ff41]"
                  : "border-[#0e2a0e] bg-[#021202] text-[#0c6d1f]"
              }`}
            >
              {match.submittedOrders[i] ? "Ready" : "Waiting"} | Player {i + 1}
              {walletKey && match.players[i]?.toBase58() === walletKey.toBase58()
                ? " | You"
                : ""}
            </div>
          ))}
        </div>
      )}

      {hasWinner && (
        <div className="mt-3 border border-[#996800] bg-[rgba(255,176,0,0.03)] px-3 py-3 text-sm uppercase tracking-[0.2em] text-[#ffb000]">
          Winner confirmed: Player {winner + 1}
        </div>
      )}
    </div>
  );
});
