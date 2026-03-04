"use client";

import { NO_WINNER, type GalaxyMatch, type BattleSummary as BattleSummaryType } from "@sdk";

interface BattleSummaryProps {
  match: GalaxyMatch;
  summary: BattleSummaryType;
}

export default function BattleSummary({ match, summary }: BattleSummaryProps) {
  const hasData = match.turn > 0 || summary.winner !== NO_WINNER;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Battle Summary</h3>
        <p className="text-slate-400 text-sm">No battles have occurred yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800">Battle Summary</h3>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Array.from({ length: match.playerCount }, (_, i) => (
          <div key={i} className="bg-slate-50 border border-slate-100 rounded p-2">
            <div className="text-slate-400 text-xs">Player {i + 1}</div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                Destroyed: {summary.destroyedByPlayer[i]}
              </span>
              <span
                className={
                  summary.commandFleetAlive[i]
                    ? "text-emerald-600"
                    : "text-red-500"
                }
              >
                {summary.commandFleetAlive[i] ? "CMD OK" : "CMD Lost"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
