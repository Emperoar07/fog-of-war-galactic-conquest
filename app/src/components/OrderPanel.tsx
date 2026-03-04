"use client";

import { useEffect, useState } from "react";
import { OrderAction, UnitType, MAP_SIZE, type GalaxyMatch } from "@sdk";

interface OrderPanelProps {
  match: GalaxyMatch;
  playerSlot: number;
  selectedCell: { x: number; y: number } | null;
  onSubmit: (order: {
    unitSlot: number;
    action: OrderAction;
    targetX: number;
    targetY: number;
  }) => Promise<void>;
  disabled: boolean;
}

const ACTION_LABELS: Record<OrderAction, string> = {
  [OrderAction.Move]: "Move",
  [OrderAction.Scout]: "Scout",
  [OrderAction.Attack]: "Attack",
};

const UNIT_LABELS: Record<number, string> = {
  [UnitType.Fighter]: "Fighter",
  [UnitType.Scout]: "Scout",
  [UnitType.Command]: "Command Fleet",
};

export default function OrderPanel({
  match,
  playerSlot,
  selectedCell,
  onSubmit,
  disabled,
}: OrderPanelProps) {
  const [unitSlot, setUnitSlot] = useState(0);
  const [action, setAction] = useState<OrderAction>(OrderAction.Move);
  const [targetX, setTargetX] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadySubmitted = match.submittedOrders[playerSlot] !== 0;

  useEffect(() => {
    if (!selectedCell) return;
    setTargetX(selectedCell.x);
    setTargetY(selectedCell.y);
  }, [selectedCell]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ unitSlot, action, targetX, targetY });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = disabled || submitting || alreadySubmitted;

  return (
    <div className="border border-[#0e2a0e] bg-[#030d03] p-4">
      <h3 className="font-[family-name:var(--font-vt323)] text-3xl tracking-[0.14em] text-[#00ff41]">
        FIRE CONTROL
      </h3>

      {alreadySubmitted && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#00e5cc]">
          Orders transmitted. Awaiting opposing commander.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[9px] uppercase tracking-[0.2em] text-[#0c6d1f]">
            Unit
          </label>
          <select
            value={unitSlot}
            onChange={(e) => setUnitSlot(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full border border-[#0e2a0e] bg-[#021202] px-2 py-2 text-sm text-[#00ff41] disabled:opacity-40"
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {UNIT_LABELS[i]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[9px] uppercase tracking-[0.2em] text-[#0c6d1f]">
            Action
          </label>
          <select
            value={action}
            onChange={(e) => setAction(Number(e.target.value) as OrderAction)}
            disabled={isDisabled}
            className="w-full border border-[#0e2a0e] bg-[#021202] px-2 py-2 text-sm text-[#ffb000] disabled:opacity-40"
          >
            {Object.entries(ACTION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[9px] uppercase tracking-[0.2em] text-[#0c6d1f]">
            Target X
          </label>
          <input
            type="number"
            min={0}
            max={MAP_SIZE - 1}
            value={targetX}
            onChange={(e) => setTargetX(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full border border-[#0e2a0e] bg-[#021202] px-2 py-2 text-sm text-[#00cc33] disabled:opacity-40"
          />
        </div>

        <div>
          <label className="mb-1 block text-[9px] uppercase tracking-[0.2em] text-[#0c6d1f]">
            Target Y
          </label>
          <input
            type="number"
            min={0}
            max={MAP_SIZE - 1}
            value={targetY}
            onChange={(e) => setTargetY(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full border border-[#0e2a0e] bg-[#021202] px-2 py-2 text-sm text-[#00cc33] disabled:opacity-40"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="mt-4 w-full border border-[#881111] bg-[rgba(255,51,51,0.04)] py-3 text-[10px] uppercase tracking-[0.24em] text-[#ff3333] hover:bg-[rgba(255,51,51,0.08)] disabled:opacity-30"
      >
        {submitting
          ? "Transmitting..."
          : alreadySubmitted
            ? "Orders Locked"
            : "Queue Order"}
      </button>

      {error && (
        <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[#ff3333]">
          {error}
        </div>
      )}
    </div>
  );
}
