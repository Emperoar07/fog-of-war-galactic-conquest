"use client";

import { MAP_SIZE } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
  highlightBoard?: boolean;
}

const CELL_BG: Record<number, string> = {
  0: "#010801",
  1: "rgba(0,50,16,0.92)",
  2: "rgba(50,18,0,0.9)",
  3: "rgba(0,30,36,0.92)",
  4: "rgba(45,0,0,0.9)",
};

const CELL_BORDER: Record<number, string> = {
  0: "#052105",
  1: "rgba(0,150,60,0.28)",
  2: "rgba(255,176,0,0.28)",
  3: "rgba(0,229,204,0.25)",
  4: "rgba(255,51,51,0.28)",
};

const DOT_COLORS: Record<number, { border: string; bg: string }> = {
  0: { border: "#0e2a0e", bg: "#031203" },
  1: { border: "#0c6d1f", bg: "#00ff41" },
  2: { border: "#996800", bg: "#ffb000" },
  3: { border: "#005f52", bg: "#00e5cc" },
  4: { border: "#881111", bg: "#ff3333" },
};

export default function GameBoard({
  revealedSectorOwner,
  selectedCell,
  onCellClick,
  highlightBoard,
}: GameBoardProps) {
  return (
    <div
      className={`w-full max-w-[48rem] border bg-[#030d03] p-2 sm:p-3 shadow-[0_0_30px_rgba(0,255,65,0.04)] transition-all duration-300 ${
        highlightBoard
          ? "border-[#ffb000] shadow-[0_0_24px_rgba(255,176,0,0.15)]"
          : "border-[#0e2a0e]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between border-b border-[#0e2a0e] pb-2 sm:mb-3">
        <div className="text-[8px] uppercase tracking-[0.34em] text-[#0c6d1f] sm:text-[9px]">
          Battlefield Grid
        </div>
        <div className="text-[8px] uppercase tracking-[0.24em] text-[#ffb000] sm:text-[9px]">
          7x7 Tactical View
        </div>
      </div>
      <div
        className="grid gap-1 sm:gap-1.5 md:gap-2"
        style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, i) => {
          const x = i % MAP_SIZE;
          const y = Math.floor(i / MAP_SIZE);
          const owner = revealedSectorOwner[i] || 0;
          const isSelected = selectedCell?.x === x && selectedCell?.y === y;
          const dot = DOT_COLORS[owner] || DOT_COLORS[0];

          return (
            <button
              key={i}
              onClick={() => onCellClick(x, y)}
              className={`group relative aspect-square min-h-[36px] border p-0.5 text-left sm:min-h-[48px] sm:p-1 md:min-h-[56px] ${
                isSelected
                  ? "scale-[1.02] border-[#ff3333] shadow-[0_0_18px_rgba(255,51,51,0.18)]"
                  : ""
              }`}
              style={{
                backgroundColor: CELL_BG[owner] || CELL_BG[0],
                borderColor: isSelected
                  ? "#ff3333"
                  : CELL_BORDER[owner] || CELL_BORDER[0],
                transition:
                  "background-color 500ms ease, border-color 500ms ease, transform 140ms ease, box-shadow 140ms ease",
              }}
              title={`Sector (${x}, ${y})`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className="text-[8px] font-semibold text-[#0c6d1f] sm:text-[10px] md:text-xs">
                  {x},{y}
                </span>
                <span
                  className="h-2 w-2 rounded-full border sm:h-2.5 sm:w-2.5 md:h-3 md:w-3"
                  style={{
                    borderColor: dot.border,
                    backgroundColor: dot.bg,
                    transition: "background-color 500ms ease, border-color 500ms ease",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
