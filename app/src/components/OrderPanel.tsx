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
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800">Submit Order</h3>

      {alreadySubmitted && (
        <div className="text-emerald-600 text-sm">
          Orders submitted for this turn. Waiting for opponent...
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-500 mb-1">Unit</label>
          <select
            value={unitSlot}
            onChange={(e) => setUnitSlot(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-sm disabled:opacity-50"
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {UNIT_LABELS[i]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(Number(e.target.value) as OrderAction)}
            disabled={isDisabled}
            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-sm disabled:opacity-50"
          >
            {Object.entries(ACTION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Target X</label>
          <input
            type="number"
            min={0}
            max={MAP_SIZE - 1}
            value={targetX}
            onChange={(e) => setTargetX(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-sm disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-500 mb-1">Target Y</label>
          <input
            type="number"
            min={0}
            max={MAP_SIZE - 1}
            value={targetY}
            onChange={(e) => setTargetY(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2 rounded transition-colors"
      >
        {submitting
          ? "Submitting..."
          : alreadySubmitted
            ? "Orders Submitted"
            : "Submit Order"}
      </button>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
    </div>
  );
}
