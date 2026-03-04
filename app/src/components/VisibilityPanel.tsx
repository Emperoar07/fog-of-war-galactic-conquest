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
    <div className="border border-[#0e2a0e] bg-[#030d03] p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#00ff41]">
          REVEALS
        </h3>
        {loading && (
          <span className="text-[9px] uppercase tracking-[0.24em] text-[#00e5cc]">
            Decrypting
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[#ff3333]">
          {error}
        </div>
      )}

      {!error && !report && !loading && (
        <div className="mt-3 text-xs leading-6 text-[#0c6d1f]">
          Request visibility to decrypt the latest scout report for this turn.
        </div>
      )}

      {!error && report && report.units.length === 0 && (
        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[#0c6d1f]">
          No enemy units are currently visible.
        </div>
      )}

      {!error && report && report.units.length > 0 && (
        <div className="mt-3 space-y-2">
          {report.units.map((unit) => (
            <div
              key={unit.slot}
              className="flex items-center justify-between border border-[#005f52] bg-[rgba(0,229,204,0.02)] px-3 py-2 text-xs"
            >
              <span className="uppercase tracking-[0.16em] text-[#00aa2a]">
                Enemy slot {unit.slot}
              </span>
              <span className="font-mono text-[#00e5cc]">
                ({unit.x}, {unit.y})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
