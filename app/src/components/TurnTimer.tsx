"use client";

import { useEffect, useState } from "react";

interface TurnTimerProps {
  active: boolean;
  label: string;
}

export default function TurnTimer({ active, label }: TurnTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Progress bar fills over 60 seconds then loops
  const progress = Math.min((elapsed % 60) / 60, 1);

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[9px]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-vt323)] text-lg tracking-[0.1em] text-[#ffb000] sm:text-xl">
          {timeStr}
        </span>
      </div>
      <div className="mt-2 h-1 w-full bg-[#0e2a0e]">
        <div
          className="h-full bg-[#00ff41] transition-all duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
