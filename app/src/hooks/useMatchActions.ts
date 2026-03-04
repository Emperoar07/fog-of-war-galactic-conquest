"use client";

import { useCallback, useState } from "react";
import type { ActivityLogEntry } from "@/lib/activity";

export function useMatchActions() {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"info" | "success" | "error">("info");
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  const appendActivity = useCallback(
    (message: string, tone: "info" | "success" | "error" = "info") => {
      const entry: ActivityLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        tone,
      };

      setActivityLog((current) => [entry, ...current].slice(0, 8));
    },
    [],
  );

  const showStatus = useCallback(
    (
      message: string,
      tone: "info" | "success" | "error" = "info",
      log = false,
    ) => {
      setActionMessage(message);
      setActionTone(tone);
      if (log) {
        appendActivity(message, tone);
      }
    },
    [appendActivity],
  );

  const resetActivity = useCallback((entries: ActivityLogEntry[]) => {
    setActivityLog(entries);
  }, []);

  return {
    actionMessage,
    actionTone,
    activityLog,
    appendActivity,
    showStatus,
    resetActivity,
    setActionMessage,
    setActionTone,
  };
}
