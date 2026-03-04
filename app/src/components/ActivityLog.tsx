"use client";

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
  info: "border-gray-700 text-gray-300",
  success: "border-green-800 text-green-300",
  error: "border-red-800 text-red-300",
};

export default function ActivityLog({ entries }: ActivityLogProps) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Activity</h3>
        <span className="text-xs text-gray-500">
          {entries.length === 0 ? "No events yet" : `${entries.length} recent`}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="text-sm text-gray-400">
          Match events and transaction progress will appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded border bg-gray-800 px-3 py-2 ${TONE_STYLES[entry.tone]}`}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium uppercase tracking-wide">
                  {entry.tone}
                </span>
                <span className="text-gray-500">{entry.time}</span>
              </div>
              <div className="mt-1 text-sm">{entry.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
