"use client";

import type { DecodedVisibilityReport } from "@sdk";

interface VisibilityPanelProps {
  report: DecodedVisibilityReport | null;
  loading: boolean;
  error: string | null;
}

export default function VisibilityPanel({
  report,
  loading,
  error,
}: VisibilityPanelProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Visibility Report</h3>
        {loading && (
          <span className="text-xs text-cyan-300">Decrypting...</span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}

      {!error && !report && !loading && (
        <div className="text-sm text-gray-400">
          Request visibility to decrypt the latest scout report for this turn.
        </div>
      )}

      {!error && report && report.units.length === 0 && (
        <div className="text-sm text-gray-400">
          No enemy units are currently visible.
        </div>
      )}

      {!error && report && report.units.length > 0 && (
        <div className="space-y-2">
          {report.units.map((unit) => (
            <div
              key={unit.slot}
              className="flex items-center justify-between rounded bg-gray-800 px-3 py-2 text-sm"
            >
              <span className="text-gray-300">Enemy Slot {unit.slot}</span>
              <span className="font-mono text-cyan-300">
                ({unit.x}, {unit.y})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
