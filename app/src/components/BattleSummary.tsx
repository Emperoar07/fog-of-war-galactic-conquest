"use client";

import { memo } from "react";
import {
  NO_WINNER,
  type GalaxyMatch,
  type BattleSummary as BattleSummaryType,
} from "@sdk";

interface BattleSummaryProps {
  match: GalaxyMatch;
  summary: BattleSummaryType;
}

export default memo(function BattleSummary({
  match,
  summary,
}: BattleSummaryProps) {
  const hasData = match.turn > 0 || summary.winner !== NO_WINNER;

  if (!hasData) {
    return (
      <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4 xl:h-[176px]">
        <h3 className="font-[family-name:var(--font-vt323)] text-xl tracking-[0.14em] text-[#00ff41] sm:text-3xl">
          BATTLE LOGIC
        </h3>
        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#0c6d1f] sm:text-xs sm:tracking-[0.16em]">
          No combat data recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4 xl:h-[176px]">
      <h3 className="font-[family-name:var(--font-vt323)] text-xl tracking-[0.14em] text-[#00ff41] sm:text-3xl">
        BATTLE LOGIC
      </h3>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 text-sm sm:mt-2.5 sm:gap-2">
        {Array.from({ length: match.playerCount }, (_, i) => (
          <div
            key={i}
            className="flex min-h-0 flex-1 flex-col justify-center border border-[#0e2a0e] bg-[#021202] px-3 py-1.5 sm:px-3 sm:py-2"
          >
            <div className="text-[8px] uppercase tracking-[0.22em] text-[#0c6d1f] sm:text-[9px] sm:tracking-[0.24em]">
              Player {i + 1}
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] uppercase tracking-[0.14em] sm:text-[10px] sm:tracking-[0.16em]">
              <span className="text-[#00aa2a]">
                Destroyed {summary.destroyedByPlayer[i]}
              </span>
              <span
                className={
                  summary.commandFleetAlive[i]
                    ? "text-[#00e5cc]"
                    : "text-[#ff3333]"
                }
              >
                {summary.commandFleetAlive[i] ? "CMD OK" : "CMD LOST"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
