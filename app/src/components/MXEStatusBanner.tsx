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
      <div className="border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#00e5cc]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#00e5cc] shadow-[0_0_8px_rgba(0,229,204,0.8)]" />
            Arcium MXE online // encrypted operations available
          </div>
          <div className="h-1.5 w-full max-w-52 border border-[#005f52] bg-[rgba(0,229,204,0.04)] sm:w-52">
            <div className="h-full w-full bg-[#00e5cc] shadow-[0_0_8px_rgba(0,229,204,0.8)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#996800] bg-[rgba(255,176,0,0.03)] px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#ffb000]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.8)]" />
          MXE cluster initializing // encrypted actions unavailable
        </div>
        <div className="h-1.5 w-full max-w-52 border border-[#996800] bg-[rgba(255,176,0,0.04)] sm:w-52">
          <div className="h-full w-2/5 animate-pulse bg-[#ffb000] shadow-[0_0_8px_rgba(255,176,0,0.6)]" />
        </div>
      </div>
    </div>
  );
}
