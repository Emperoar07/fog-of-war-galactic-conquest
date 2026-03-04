"use client";

import { MAP_SIZE } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
}

const CELL_COLORS: Record<number, string> = {
  0: "bg-[#010801] hover:bg-[#031203] border-[#052105]",
  1: "bg-[rgba(0,50,16,0.92)] hover:bg-[rgba(0,70,20,0.96)] border-[rgba(0,150,60,0.28)]",
  2: "bg-[rgba(50,18,0,0.9)] hover:bg-[rgba(70,24,0,0.95)] border-[rgba(255,176,0,0.28)]",
  3: "bg-[rgba(0,30,36,0.92)] hover:bg-[rgba(0,48,58,0.95)] border-[rgba(0,229,204,0.25)]",
  4: "bg-[rgba(45,0,0,0.9)] hover:bg-[rgba(60,0,0,0.95)] border-[rgba(255,51,51,0.28)]",
};

export default function GameBoard({
  revealedSectorOwner,
  selectedCell,
  onCellClick,
}: GameBoardProps) {
  return (
    <div className="w-full max-w-[48rem] border border-[#0e2a0e] bg-[#030d03] p-3 shadow-[0_0_30px_rgba(0,255,65,0.04)]">
      <div className="mb-3 flex items-center justify-between border-b border-[#0e2a0e] pb-2">
        <div className="text-[9px] uppercase tracking-[0.34em] text-[#0c6d1f]">
          Battlefield Grid
        </div>
        <div className="text-[9px] uppercase tracking-[0.24em] text-[#ffb000]">
          8x8 Tactical View
        </div>
      </div>
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, i) => {
          const x = i % MAP_SIZE;
          const y = Math.floor(i / MAP_SIZE);
          const owner = revealedSectorOwner[i] || 0;
          const isSelected = selectedCell?.x === x && selectedCell?.y === y;
          const baseColor = CELL_COLORS[owner] || CELL_COLORS[0];

          return (
            <button
              key={i}
              onClick={() => onCellClick(x, y)}
              className={`group aspect-square min-h-[42px] border p-1 text-left sm:min-h-[56px] ${baseColor} ${
                isSelected
                  ? "scale-[1.02] border-[#ff3333] shadow-[0_0_18px_rgba(255,51,51,0.18)]"
                  : ""
              }`}
              title={`Sector (${x}, ${y})`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className="text-[10px] font-semibold text-[#0c6d1f] sm:text-xs">
                  {x},{y}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full border sm:h-3 sm:w-3 ${
                    owner === 0
                      ? "border-[#0e2a0e] bg-[#031203]"
                      : owner === 1
                        ? "border-[#0c6d1f] bg-[#00ff41]"
                        : owner === 2
                          ? "border-[#996800] bg-[#ffb000]"
                          : owner === 3
                            ? "border-[#005f52] bg-[#00e5cc]"
                            : "border-[#881111] bg-[#ff3333]"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
