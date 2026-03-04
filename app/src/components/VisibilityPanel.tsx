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
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Visibility Report</h3>
        {loading && (
          <span className="text-xs text-slate-400">Decrypting...</span>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {!error && !report && !loading && (
        <div className="text-sm text-slate-400">
          Request visibility to decrypt the latest scout report for this turn.
        </div>
      )}

      {!error && report && report.units.length === 0 && (
        <div className="text-sm text-slate-400">
          No enemy units are currently visible.
        </div>
      )}

      {!error && report && report.units.length > 0 && (
        <div className="space-y-2">
          {report.units.map((unit) => (
            <div
              key={unit.slot}
              className="flex items-center justify-between rounded bg-slate-50 border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="text-slate-600">Enemy Slot {unit.slot}</span>
              <span className="font-mono text-slate-800">
                ({unit.x}, {unit.y})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
