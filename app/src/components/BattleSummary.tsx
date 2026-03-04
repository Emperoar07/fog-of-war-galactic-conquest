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
      <div className="border border-[#0e2a0e] bg-[#030d03] p-4">
        <h3 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#00ff41]">
          BATTLE LOGIC
        </h3>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#0c6d1f]">
          No combat data recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] p-4">
      <h3 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#00ff41]">
        BATTLE LOGIC
      </h3>

      <div className="mt-3 grid gap-2 text-sm">
        {Array.from({ length: match.playerCount }, (_, i) => (
          <div
            key={i}
            className="border border-[#0e2a0e] bg-[#021202] px-3 py-3"
          >
            <div className="text-[9px] uppercase tracking-[0.24em] text-[#0c6d1f]">
              Player {i + 1}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em]">
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
