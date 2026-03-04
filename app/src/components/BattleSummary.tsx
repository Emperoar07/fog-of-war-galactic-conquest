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
      <div className="bg-gray-900 border border-gray-700 rounded p-4">
        <h3 className="text-lg font-bold text-white mb-2">Battle Summary</h3>
        <p className="text-gray-500 text-sm">No battles have occurred yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-2">
      <h3 className="text-lg font-bold text-white">Battle Summary</h3>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Array.from({ length: match.playerCount }, (_, i) => (
          <div key={i} className="bg-gray-800 rounded p-2">
            <div className="text-gray-400 text-xs">Player {i + 1}</div>
            <div className="flex justify-between">
              <span className="text-gray-300">
                Destroyed: {summary.destroyedByPlayer[i]}
              </span>
              <span
                className={
                  summary.commandFleetAlive[i]
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {summary.commandFleetAlive[i] ? "CMD ✓" : "CMD ✗"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
