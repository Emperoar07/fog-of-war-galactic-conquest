"use client";

import { memo } from "react";

type ActivityTone = "info" | "success" | "error";

export interface ActivityLogEntry {
  id: string;
  message: string;
  time: string;
  tone: ActivityTone;
}

interface ActivityLogProps {
  entries: ActivityLogEntry[];
}

const TONE_STYLES: Record<ActivityTone, string> = {
  info: "border-slate-200 text-slate-600",
  success: "border-emerald-200 text-emerald-700",
  error: "border-red-200 text-red-600",
};

export default memo(function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Activity</h3>
        <span className="text-xs text-slate-400">
          {entries.length === 0 ? "No events yet" : `${entries.length} recent`}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-slate-400">
          Match events and transaction progress will appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded border bg-slate-50 px-3 py-2 ${TONE_STYLES[entry.tone]}`}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium uppercase tracking-wide">
                  {entry.tone}
                </span>
                <span className="text-slate-400">{entry.time}</span>
              </div>
              <div className="mt-1 text-sm">{entry.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
})
