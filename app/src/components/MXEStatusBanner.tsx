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
      <div className="bg-green-900/50 border border-green-700 text-green-300 px-4 py-2 rounded text-sm">
        Connected to Arcium MXE — encrypted operations available
      </div>
    );
  }

  return (
    <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-4 py-2 rounded text-sm">
      MXE cluster initializing — encrypted actions (create match, submit orders)
      are temporarily unavailable. Read-only operations work normally.
    </div>
  );
}
