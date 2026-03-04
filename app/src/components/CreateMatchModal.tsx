"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameClient } from "@/hooks/useGameClient";

interface CreateMatchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateMatchModal({ open, onClose }: CreateMatchModalProps) {
  const client = useGameClient();
  const router = useRouter();
  const [mapSeed, setMapSeed] = useState("42");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = async () => {
    if (!client) return;
    setCreating(true);
    setError(null);
    setStatusMessage("Preparing encrypted match initialization...");
    try {
      const matchId = BigInt(Math.floor(Math.random() * 1_000_000_000));
      const result = await client.createMatch(
        matchId,
        2,
        BigInt(mapSeed || "42"),
      );
      setStatusMessage("Match queued. Waiting for callback completion...");
      await client.awaitComputation(result.computationOffset);
      setStatusMessage("Match ready. Opening battlefield...");
      router.push(`/match/${matchId.toString()}`);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create match");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-xl font-bold text-slate-800">Create New Match</h2>

        <div>
          <label className="block text-sm text-slate-500 mb-1">
            Map Seed (determines starting positions)
          </label>
          <input
            type="number"
            value={mapSeed}
            onChange={(e) => setMapSeed(e.target.value)}
            disabled={creating}
            className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 disabled:opacity-50"
          />
        </div>

        <div className="text-sm text-slate-400">
          2-player match. You will be Player 1 (slot 0).
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        {statusMessage && !error && (
          <div className="text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded p-2">
            {statusMessage}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !client}
            className="flex-1 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium py-2 rounded transition-colors"
          >
            {creating ? "Creating..." : "Create Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
