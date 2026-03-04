"use client";

import { useState } from "react";
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
  [UnitType.Command]: "Command Fleet",
  [UnitType.Scout]: "Scout",
  [UnitType.Frigate]: "Frigate",
  [UnitType.Destroyer]: "Destroyer",
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

  // Sync target from clicked cell
  if (selectedCell && (selectedCell.x !== targetX || selectedCell.y !== targetY)) {
    setTargetX(selectedCell.x);
    setTargetY(selectedCell.y);
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ unitSlot, action, targetX, targetY });
    } catch (err: any) {
      setError(err.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = disabled || submitting || alreadySubmitted;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-3">
      <h3 className="text-lg font-bold text-white">Submit Order</h3>

      {alreadySubmitted && (
        <div className="text-green-400 text-sm">
          Orders submitted for this turn. Waiting for opponent...
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Unit</label>
          <select
            value={unitSlot}
            onChange={(e) => setUnitSlot(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={i}>
                {UNIT_LABELS[i]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(Number(e.target.value) as OrderAction)}
            disabled={isDisabled}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          >
            {Object.entries(ACTION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Target X</label>
          <input
            type="number"
            min={0}
            max={MAP_SIZE - 1}
            value={targetX}
            onChange={(e) => setTargetX(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Target Y</label>
          <input
            type="number"
            min={0}
            max={MAP_SIZE - 1}
            value={targetY}
            onChange={(e) => setTargetY(Number(e.target.value))}
            disabled={isDisabled}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm disabled:opacity-50"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
      >
        {submitting
          ? "Submitting..."
          : alreadySubmitted
            ? "Orders Submitted"
            : "Submit Order"}
      </button>

      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}
    </div>
  );
}
