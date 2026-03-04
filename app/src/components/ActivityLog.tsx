"use client";

import { memo } from "react";
import type { ActivityLogEntry } from "@/lib/activity";

type ActivityTone = "info" | "success" | "error";

interface ActivityLogProps {
  entries: ActivityLogEntry[];
}

const TONE_STYLES: Record<ActivityTone, string> = {
  info: "border-[#0e2a0e] text-[#00aa2a]",
  success: "border-[#005f52] text-[#00e5cc]",
  error: "border-[#881111] text-[#ff3333]",
};

export default memo(function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-vt323)] text-2xl tracking-[0.14em] text-[#00ff41] sm:text-3xl">
          ACTIVITY
        </h3>
        <span className="text-[9px] uppercase tracking-[0.24em] text-[#0c6d1f]">
          {entries.length === 0 ? "No events" : `${entries.length} recent`}
        </span>
      </div>

      <div className="mt-3 h-56 overflow-y-auto pr-1 sm:h-64">
        {entries.length === 0 ? (
          <div className="flex h-full items-center text-xs uppercase tracking-[0.16em] text-[#0c6d1f]">
            Match events and transaction progress will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`border bg-[#021202] px-3 py-2 ${TONE_STYLES[entry.tone]}`}
              >
                <div className="flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.18em]">
                  <span>{entry.tone}</span>
                  <span className="text-[#0c6d1f]">{entry.time}</span>
                </div>
                <div className="mt-1 text-xs leading-5">{entry.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
