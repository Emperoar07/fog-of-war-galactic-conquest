"use client";

import { MAP_SIZE } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
}

const CELL_COLORS: Record<number, string> = {
  0: "bg-slate-900 hover:bg-slate-800 border-slate-700",
  1: "bg-blue-900/80 hover:bg-blue-800/80 border-blue-700",
  2: "bg-rose-900/80 hover:bg-rose-800/80 border-rose-700",
  3: "bg-emerald-900/80 hover:bg-emerald-800/80 border-emerald-700",
  4: "bg-amber-900/80 hover:bg-amber-800/80 border-amber-700",
};

export default function GameBoard({
  revealedSectorOwner,
  selectedCell,
  onCellClick,
}: GameBoardProps) {
  return (
    <div className="w-full max-w-[44rem] rounded-3xl border border-gray-800 bg-gray-950/80 p-4 shadow-2xl">
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
                  ? "scale-[1.03] ring-2 ring-cyan-300 shadow-lg shadow-cyan-500/20"
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
                      ? "bg-slate-600"
                      : owner === 1
                        ? "bg-blue-300"
                        : owner === 2
                          ? "bg-rose-300"
                          : owner === 3
                            ? "bg-emerald-300"
                            : "bg-amber-300"
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
