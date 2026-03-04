"use client";

import { MAP_SIZE } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
}

const CELL_COLORS: Record<number, string> = {
  0: "bg-gray-800 hover:bg-gray-700",    // unclaimed
  1: "bg-blue-800 hover:bg-blue-700",     // player 1
  2: "bg-red-800 hover:bg-red-700",       // player 2
  3: "bg-green-800 hover:bg-green-700",   // player 3
  4: "bg-purple-800 hover:bg-purple-700", // player 4
};

export default function GameBoard({
  revealedSectorOwner,
  selectedCell,
  onCellClick,
}: GameBoardProps) {
  return (
    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, 1fr)` }}>
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
            className={`w-12 h-12 rounded text-xs font-mono transition-all ${baseColor} ${
              isSelected ? "ring-2 ring-yellow-400 scale-105" : ""
            }`}
            title={`(${x}, ${y})`}
          >
            <span className="text-gray-500">
              {x},{y}
            </span>
          </button>
        );
      })}
    </div>
  );
}
