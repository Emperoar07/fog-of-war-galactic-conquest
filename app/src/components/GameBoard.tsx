"use client";

import { memo, useCallback, useEffect } from "react";
import { MAP_SIZE, UnitType, UNITS_PER_PLAYER } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
  highlightBoard?: boolean;
  unitPositions?: { slot: number; x: number; y: number }[];
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

function slotToUnitType(slot: number): UnitType {
  const localSlot = slot % UNITS_PER_PLAYER;
  if (localSlot === 0) return UnitType.Command;
  if (localSlot === 1) return UnitType.Scout;
  return UnitType.Fighter;
}

const UNIT_ICONS: Record<UnitType, string> = {
  [UnitType.Fighter]: "F",
  [UnitType.Scout]: "S",
  [UnitType.Command]: "C",
};

function hapticTap() {
  try {
    navigator?.vibrate?.(12);
  } catch {
    // vibrate not available
  }
}

const BoardCell = memo(function BoardCell({
  x,
  y,
  owner,
  isSelected,
  unitIcon,
  onClick,
}: {
  x: number;
  y: number;
  owner: number;
  isSelected: boolean;
  unitIcon: string | null;
  onClick: (x: number, y: number) => void;
}) {
  const dot = DOT_COLORS[owner] || DOT_COLORS[0];

  return (
    <button
      onClick={() => {
        hapticTap();
        onClick(x, y);
      }}
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
      aria-label={`Sector ${x},${y}${isSelected ? " selected" : ""}${unitIcon ? ` unit ${unitIcon}` : ""}`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-[8px] font-semibold text-[#0c6d1f] sm:text-[10px] md:text-xs">
            {x},{y}
          </span>
          {unitIcon && (
            <span className="text-[8px] font-bold text-[#b8ffc8] sm:text-[10px]">
              {unitIcon}
            </span>
          )}
        </div>
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
});

export default function GameBoard({
  revealedSectorOwner,
  selectedCell,
  onCellClick,
  highlightBoard,
  unitPositions,
}: GameBoardProps) {
  const unitMap = new Map<string, string>();
  if (unitPositions) {
    for (const u of unitPositions) {
      const type = slotToUnitType(u.slot);
      unitMap.set(`${u.x},${u.y}`, UNIT_ICONS[type]);
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) return;
      e.preventDefault();

      const sx = selectedCell?.x ?? 0;
      const sy = selectedCell?.y ?? 0;
      let nx = sx;
      let ny = sy;

      switch (e.key) {
        case "ArrowUp": ny = Math.max(0, sy - 1); break;
        case "ArrowDown": ny = Math.min(MAP_SIZE - 1, sy + 1); break;
        case "ArrowLeft": nx = Math.max(0, sx - 1); break;
        case "ArrowRight": nx = Math.min(MAP_SIZE - 1, sx + 1); break;
        case "Enter":
          onCellClick(sx, sy);
          hapticTap();
          return;
      }

      if (nx !== sx || ny !== sy) {
        onCellClick(nx, ny);
        hapticTap();
      }
    },
    [selectedCell, onCellClick],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`w-full max-w-[48rem] border bg-[#030d03] p-2 sm:p-3 shadow-[0_0_30px_rgba(0,255,65,0.04)] transition-all duration-300 ${
        highlightBoard
          ? "border-[#ffb000] shadow-[0_0_24px_rgba(255,176,0,0.15)]"
          : "border-[#0e2a0e]"
      }`}
    >
      <div className="mb-2 border-b border-[#0e2a0e] pb-2 sm:mb-3">
        <div className="text-[8px] uppercase tracking-[0.34em] text-[#0c6d1f] sm:text-[9px]">
          Battlefield Grid
        </div>
      </div>
      <div
        className="grid gap-1 sm:gap-1.5 md:gap-2"
        style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Battlefield grid"
      >
        {Array.from({ length: MAP_SIZE * MAP_SIZE }, (_, i) => {
          const x = i % MAP_SIZE;
          const y = Math.floor(i / MAP_SIZE);
          return (
            <BoardCell
              key={i}
              x={x}
              y={y}
              owner={revealedSectorOwner[i] || 0}
              isSelected={selectedCell?.x === x && selectedCell?.y === y}
              unitIcon={unitMap.get(`${x},${y}`) ?? null}
              onClick={onCellClick}
            />
          );
        })}
      </div>
    </div>
  );
}
