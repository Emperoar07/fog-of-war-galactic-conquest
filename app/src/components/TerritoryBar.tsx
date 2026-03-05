"use client";

import { MAP_SIZE } from "@sdk";

interface TerritoryBarProps {
  revealedSectorOwner: number[];
  winThreshold?: number;
}

const TOTAL = MAP_SIZE * MAP_SIZE;

export default function TerritoryBar({
  revealedSectorOwner,
  winThreshold = 0.55,
}: TerritoryBarProps) {
  const friendly = revealedSectorOwner.filter((t) => t === 1).length;
  const enemy = revealedSectorOwner.filter((t) => t === 2).length;
  const contested = revealedSectorOwner.filter((t) => t === 3).length;
  const neutral = revealedSectorOwner.filter((t) => t === 0).length;

  const friendlyPct = (friendly / TOTAL) * 100;
  const enemyPct = (enemy / TOTAL) * 100;
  const contestedPct = (contested / TOTAL) * 100;

  const winTarget = Math.floor(TOTAL * winThreshold);
  const friendlyProgress = Math.min(100, (friendly / winTarget) * 100);
  const enemyProgress = Math.min(100, (enemy / winTarget) * 100);

  const friendlyLeads = friendly > enemy;
  const tied = friendly === enemy;

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] px-2.5 py-2 sm:px-4 sm:py-3">
      {/* Territory tug-of-war bar */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-[#00ff41] sm:text-[9px]">
          {friendly}
        </span>
        <div className="relative h-3 flex-1 overflow-hidden border border-[#0e2a0e] bg-[#010801] sm:h-4">
          {/* Player territory (green, from left) */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${friendlyPct}%`,
              background: "linear-gradient(90deg, #00ff41, #00cc33)",
              boxShadow: "0 0 8px rgba(0,255,65,0.3)",
            }}
          />
          {/* Contested zone (cyan, in middle) */}
          <div
            className="absolute inset-y-0 transition-all duration-500"
            style={{
              left: `${friendlyPct}%`,
              width: `${contestedPct}%`,
              background: "rgba(0,229,204,0.4)",
            }}
          />
          {/* Enemy territory (amber, from right) */}
          <div
            className="absolute inset-y-0 right-0 transition-all duration-500"
            style={{
              width: `${enemyPct}%`,
              background: "linear-gradient(270deg, #ffb000, #996800)",
              boxShadow: "0 0 8px rgba(255,176,0,0.3)",
            }}
          />
          {/* Win threshold markers */}
          <div
            className="absolute inset-y-0 w-px bg-[#ff3333] opacity-60"
            style={{ left: `${winThreshold * 100}%` }}
            title={`Win threshold: ${winTarget} tiles`}
          />
          <div
            className="absolute inset-y-0 w-px bg-[#ff3333] opacity-60"
            style={{ right: `${winThreshold * 100}%` }}
            title={`Win threshold: ${winTarget} tiles`}
          />
        </div>
        <span className="shrink-0 text-[8px] font-bold uppercase tracking-[0.14em] text-[#ffb000] sm:text-[9px]">
          {enemy}
        </span>
      </div>

      {/* Stats row */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* Territory counts */}
        <div className="flex gap-3 text-[7px] uppercase tracking-[0.14em] sm:text-[8px]">
          <span className="text-[#00ff41]">
            You: {friendly}
          </span>
          <span className="text-[#ffb000]">
            AI: {enemy}
          </span>
          <span className="text-[#00e5cc]">
            Contested: {contested}
          </span>
          <span className="text-[#0c6d1f]">
            Neutral: {neutral}
          </span>
        </div>

        {/* Win progress */}
        <div className="text-[7px] uppercase tracking-[0.14em] sm:text-[8px]">
          {tied ? (
            <span className="text-[#00e5cc]">Tied — {winTarget} to win</span>
          ) : friendlyLeads ? (
            <span className="text-[#00ff41]">
              {friendly >= winTarget
                ? "Victory threshold reached!"
                : `${winTarget - friendly} more to win`}
            </span>
          ) : (
            <span className="text-[#ff3333]">
              {enemy >= winTarget
                ? "AI reached victory threshold!"
                : `AI needs ${winTarget - enemy} more`}
            </span>
          )}
        </div>
      </div>

      {/* Mini progress bars for win threshold */}
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center justify-between text-[6px] uppercase tracking-[0.12em] sm:text-[7px]">
            <span className="text-[#0c6d1f]">Your Progress</span>
            <span className="text-[#00ff41]">{Math.round(friendlyProgress)}%</span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden bg-[#0e2a0e]">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${friendlyProgress}%`,
                background: friendlyProgress >= 100 ? "#00ff41" : "#0c6d1f",
                boxShadow: friendlyProgress >= 90 ? "0 0 6px rgba(0,255,65,0.5)" : "none",
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[6px] uppercase tracking-[0.12em] sm:text-[7px]">
            <span className="text-[#0c6d1f]">AI Progress</span>
            <span className="text-[#ffb000]">{Math.round(enemyProgress)}%</span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden bg-[#0e2a0e]">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${enemyProgress}%`,
                background: enemyProgress >= 100 ? "#ff3333" : "#996800",
                boxShadow: enemyProgress >= 90 ? "0 0 6px rgba(255,51,51,0.5)" : "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Board legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#0e2a0e] pt-1.5">
        {[
          { color: "#00ff41", border: "#0c6d1f", label: "Your Territory" },
          { color: "#ffb000", border: "#996800", label: "Enemy Territory" },
          { color: "#00e5cc", border: "#005f52", label: "Contested" },
          { color: "#0c6d1f", border: "#052105", label: "Neutral" },
          { color: "#ff3333", border: "#881111", label: "Destroyed" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full border"
              style={{ backgroundColor: item.color, borderColor: item.border }}
            />
            <span className="text-[6px] uppercase tracking-[0.12em] text-[#0c6d1f] sm:text-[7px]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
