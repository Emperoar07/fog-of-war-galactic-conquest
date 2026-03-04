"use client";

import { useState, useEffect } from "react";
import { useGameClient } from "@/hooks/useGameClient";
import type { MXEStatus } from "@sdk";

export default function MXEStatusBanner() {
  const client = useGameClient();
  const [status, setStatus] = useState<MXEStatus | null>(null);

  useEffect(() => {
    if (!client) return;
    client.isReady().then(setStatus);
  }, [client]);

  if (!status) return null;

  if (status.ready) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
        Connected to Arcium MXE — encrypted operations available
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
      MXE cluster initializing — encrypted actions (create match, submit orders)
      are temporarily unavailable. Read-only operations work normally.
    </div>
  );
}
