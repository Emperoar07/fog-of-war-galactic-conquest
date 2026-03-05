"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { MAP_SIZE, UnitType, UNITS_PER_PLAYER } from "@sdk";

interface GameBoardProps {
  revealedSectorOwner: number[];
  selectedCell: { x: number; y: number } | null;
  onCellClick: (x: number, y: number) => void;
  highlightBoard?: boolean;
  unitPositions?: { slot: number; x: number; y: number }[]; 
  pendingOrder?: { x: number; y: number; action: string } | null;
  turn?: number;
  changedTiles?: number[];
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

const UNIT_STATUS_COLORS: Record<UnitType, string> = {
  [UnitType.Fighter]: "#ffb000",
  [UnitType.Scout]: "#00e5cc",
  [UnitType.Command]: "#00ff41",
};

const BoardCell = memo(function BoardCell({
  x,
  y,
  owner,
  isSelected,
  unitIcon,
  unitType,
  pendingAction,
  changed,
  onClick,
}: {
  x: number;
  y: number;
  owner: number;
  isSelected: boolean;
  unitIcon: string | null;
  unitType: UnitType | null;
  pendingAction: string | null;
  changed: boolean;
  onClick: (x: number, y: number) => void;
}) {
  const dot = DOT_COLORS[owner] || DOT_COLORS[0];

  return (
    <button
      onClick={() => {
        hapticTap();
        onClick(x, y);
      }}
      className={`group relative aspect-square border p-0.5 text-left sm:p-1 ${
        isSelected
          ? "scale-[1.02] border-[#ff3333] shadow-[0_0_18px_rgba(255,51,51,0.18)]"
          : ""
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e5cc] focus-visible:ring-offset-1 focus-visible:ring-offset-[#010801]`}
      style={{
        backgroundColor: CELL_BG[owner] || CELL_BG[0],
        borderColor: isSelected
          ? "#ff3333"
          : CELL_BORDER[owner] || CELL_BORDER[0],
        transitionDelay: `${(x + y) * 18}ms`,
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
          <div className="flex items-center gap-1">
            {unitType !== null && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: UNIT_STATUS_COLORS[unitType] }}
                title="Unit status"
              />
            )}
            {unitIcon && (
              <span className="text-[8px] font-bold text-[#b8ffc8] sm:text-[10px]">
                {unitIcon}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <span
            className="h-2 w-2 rounded-full border sm:h-2.5 sm:w-2.5 md:h-3 md:w-3"
            style={{
              borderColor: dot.border,
              backgroundColor: dot.bg,
              transitionDelay: `${(x + y) * 18}ms`,
              transition: "background-color 500ms ease, border-color 500ms ease",
            }}
          />
          {pendingAction && (
            <span className="rounded border border-[#996800] bg-[rgba(255,176,0,0.05)] px-1 py-0.5 text-[6px] uppercase tracking-[0.14em] text-[#ffb000] sm:text-[7px]">
              {pendingAction}
            </span>
          )}
        </div>
        {changed && (
          <span
            className="pointer-events-none absolute inset-0 rounded-[1px]"
            style={{
              animation: "tileFlash 800ms ease-out",
              boxShadow: "inset 0 0 0 1px rgba(0,229,204,0.45), 0 0 16px rgba(0,229,204,0.18)",
              background:
                "linear-gradient(135deg, rgba(0,229,204,0.14), rgba(0,255,65,0.06) 45%, transparent 80%)",
            }}
          />
        )}
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
  pendingOrder,
  turn,
  changedTiles = [],
}: GameBoardProps) {
  const unitMap = new Map<string, string>();
  const unitTypeMap = new Map<string, UnitType>();
  if (unitPositions) {
    for (const u of unitPositions) {
      const type = slotToUnitType(u.slot);
      unitMap.set(`${u.x},${u.y}`, UNIT_ICONS[type]);
      unitTypeMap.set(`${u.x},${u.y}`, type);
    }
  }

  const sweepKey = turn ?? "no-turn";
  const changedSet = new Set(changedTiles);

  // Mobile zoom
  const [zoomed, setZoomed] = useState(false);

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
      <div className="mb-2 flex items-center justify-between border-b border-[#0e2a0e] pb-2 sm:mb-3">
        <div>
          <div className="text-[8px] uppercase tracking-[0.34em] text-[#0c6d1f] sm:text-[9px]">
            Battlefield Grid
          </div>
          <div
            id="battlefield-keyboard-hint"
            className="mt-1 text-[8px] uppercase tracking-[0.14em] text-[#084010] sm:text-[9px]"
          >
            Arrow keys move the selector. Press Enter to lock the current sector.
          </div>
        </div>
        <button
          onClick={() => setZoomed((z) => !z)}
          className="shrink-0 border border-[#0e2a0e] bg-[#021202] px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-[#0c6d1f] hover:border-[#0c6d1f] hover:text-[#00aa2a] sm:hidden"
          aria-label={zoomed ? "Zoom out battlefield" : "Zoom in battlefield"}
        >
          {zoomed ? "Zoom Out" : "Zoom In"}
        </button>
      </div>
      <div className={`relative ${zoomed ? "overflow-auto" : ""}`}>
        {/* Radar sweep overlay */}
        {turn !== undefined && (
          <div
            key={`sweep-${sweepKey}`}
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(0,255,65,0.12), transparent)",
              animation: "radarSweep 1.2s ease-out",
            }}
          />
        )}
        <div
          className={`grid gap-1 sm:gap-1.5 md:gap-2 ${zoomed ? "min-w-[480px]" : ""}`}
          style={{ gridTemplateColumns: `repeat(${MAP_SIZE}, minmax(0, 1fr))` }}
          role="grid"
          aria-label="Battlefield grid"
          aria-describedby="battlefield-keyboard-hint"
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
                unitType={unitTypeMap.get(`${x},${y}`) ?? null}
                pendingAction={
                  pendingOrder && pendingOrder.x === x && pendingOrder.y === y
                    ? pendingOrder.action
                    : null
                }
                changed={changedSet.has(i)}
                onClick={onCellClick}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
