"use client";

import { useCallback, useState } from "react";
import {
  clearDemoHistory,
  loadDemoHistory,
  type DemoSnapshot,
} from "@/lib/demo";
import { MAP_SIZE } from "@sdk";

interface DemoReplayProps {
  onApplySnapshot?: (snapshot: DemoSnapshot) => void;
}

const MINI_COLORS: Record<number, string> = {
  0: "#010801",
  1: "#00ff41",
  2: "#ffb000",
  3: "#00e5cc",
  4: "#ff3333",
};

function MiniBoard({ tiles }: { tiles: number[] }) {
  return (
    <div
      className="grid gap-px"
      style={{
        gridTemplateColumns: `repeat(${MAP_SIZE}, 1fr)`,
        width: "70px",
        height: "70px",
      }}
    >
      {tiles.map((owner, i) => (
        <div
          key={i}
          style={{ backgroundColor: MINI_COLORS[owner] || MINI_COLORS[0] }}
        />
      ))}
    </div>
  );
}

export default function DemoReplay({ onApplySnapshot }: DemoReplayProps) {
  const [history, setHistory] = useState<DemoSnapshot[]>(() => loadDemoHistory());
  const [expanded, setExpanded] = useState(false);

  const handleClear = useCallback(() => {
    clearDemoHistory();
    setHistory([]);
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] p-3 sm:p-4">
      <button
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-[8px] uppercase tracking-[0.3em] text-[#0c6d1f] sm:text-[9px]">
            Mission Archive
          </div>
          <div className="mt-1 font-[family-name:var(--font-vt323)] text-xl tracking-[0.14em] text-[#00e5cc] sm:text-2xl">
            REPLAY ({history.length})
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#0c6d1f]">
          {expanded ? "Close" : "Open"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-3">
            {history.map((snap) => (
              <button
                key={snap.turn}
                onClick={() => onApplySnapshot?.(snap)}
                className="group border border-[#0e2a0e] bg-[#021202] p-2 hover:border-[#0c6d1f]"
                title={`Jump to turn ${snap.turn}`}
              >
                <MiniBoard tiles={snap.revealedSectorOwner} />
                <div className="mt-1 text-center text-[8px] uppercase tracking-[0.2em] text-[#0c6d1f] group-hover:text-[#00ff41] sm:text-[9px]">
                  Turn {snap.turn}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleClear}
            className="border border-[#0e2a0e] bg-[#021202] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#0c6d1f] hover:border-[#881111] hover:text-[#ff3333]"
          >
            Clear Archive
          </button>
        </div>
      )}
    </div>
  );
}
