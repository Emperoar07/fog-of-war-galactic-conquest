"use client";

import { memo } from "react";
import { MAP_SIZE } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
}

const CELL_COLORS: Record<number, string> = {
  0: "bg-slate-50 hover:bg-slate-100 border-slate-200",
  1: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  2: "bg-rose-50 hover:bg-rose-100 border-rose-200",
  3: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  4: "bg-amber-50 hover:bg-amber-100 border-amber-200",
};

export default memo(function GameBoard({
  revealedSectorOwner,
  selectedCell,
  onCellClick,
}: GameBoardProps) {
  return (
    <div className="w-full max-w-[44rem] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
              className={`group aspect-square min-h-[42px] rounded-xl border p-1 text-left transition-all sm:min-h-[54px] ${baseColor} ${
                isSelected
                  ? "scale-[1.03] ring-2 ring-slate-400 shadow-md"
                  : ""
              }`}
              title={`Sector (${x}, ${y})`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 sm:text-xs">
                  {x},{y}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${
                    owner === 0
                      ? "bg-slate-300"
                      : owner === 1
                        ? "bg-blue-400"
                        : owner === 2
                          ? "bg-rose-400"
                          : owner === 3
                            ? "bg-emerald-400"
                            : "bg-amber-400"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
})
