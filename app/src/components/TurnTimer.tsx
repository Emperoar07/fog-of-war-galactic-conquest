"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TURN_TIMEOUT_SECONDS } from "@sdk";

interface TurnTimerProps {
  /** Unix timestamp (seconds) when the current turn started, or 0 if not started. */
  turnStartedAt: number;
  /** Whether to show the timer at all. */
  active: boolean;
  /** Label above the timer. */
  label: string;
  /** Called automatically when the deadline expires. */
  onForfeit?: () => void;
  /** Disable the forfeit button (e.g. while a tx is pending). */
  forfeitDisabled?: boolean;
}

export default function TurnTimer({
  turnStartedAt,
  active,
  label,
  onForfeit,
  forfeitDisabled,
}: TurnTimerProps) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const autoForfeitFired = useRef(false);
  const onForfeitRef = useRef(onForfeit);

  useEffect(() => {
    onForfeitRef.current = onForfeit;
  }, [onForfeit]);

  // Reset auto-forfeit flag when turn changes
  useEffect(() => {
    autoForfeitFired.current = false;
  }, [turnStartedAt]);

  useEffect(() => {
    if (!active || !turnStartedAt) return;
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, turnStartedAt]);

  // Auto-forfeit when deadline expires
  const deadline = turnStartedAt ? turnStartedAt + TURN_TIMEOUT_SECONDS : 0;
  const remaining = turnStartedAt ? Math.max(0, deadline - now) : TURN_TIMEOUT_SECONDS;
  const expired = turnStartedAt > 0 && remaining === 0;

  const triggerForfeit = useCallback(() => {
    if (!autoForfeitFired.current && !forfeitDisabled && onForfeitRef.current) {
      autoForfeitFired.current = true;
      onForfeitRef.current();
    }
  }, [forfeitDisabled]);

  useEffect(() => {
    if (expired && active) {
      triggerForfeit();
    }
  }, [expired, active, triggerForfeit]);

  if (!active || !turnStartedAt) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progress = Math.max(0, Math.min(1, 1 - remaining / TURN_TIMEOUT_SECONDS));

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase tracking-[0.28em] text-[#0c6d1f] sm:text-[9px]">
          {label}
        </span>
        <span
          className={`font-[family-name:var(--font-vt323)] text-lg tracking-[0.1em] sm:text-xl ${
            expired ? "text-[#ff3333]" : remaining <= 15 ? "text-[#ffb000]" : "text-[#00ff41]"
          }`}
        >
          {expired ? "TIMEOUT" : timeStr}
        </span>
      </div>
      <div className="mt-2 h-1 w-full bg-[#0e2a0e]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            expired ? "bg-[#ff3333]" : remaining <= 15 ? "bg-[#ffb000]" : "bg-[#00ff41]"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {expired && onForfeit && (
        <button
          onClick={onForfeit}
          disabled={forfeitDisabled}
          className="mt-2 w-full border border-[#881111] bg-[rgba(35,0,0,0.9)] px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-[#ff3333] hover:bg-[rgba(60,0,0,0.9)] disabled:opacity-40 sm:text-[10px]"
        >
          Forfeit Match (Timeout)
        </button>
      )}
    </div>
  );
}
