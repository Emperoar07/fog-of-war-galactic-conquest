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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold text-white">Create New Match</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Map Seed (determines starting positions)
          </label>
          <input
            type="number"
            value={mapSeed}
            onChange={(e) => setMapSeed(e.target.value)}
            disabled={creating}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50"
          />
        </div>

        <div className="text-sm text-gray-500">
          2-player match. You will be Player 1 (slot 0).
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded p-2">
            {error}
          </div>
        )}

        {statusMessage && !error && (
          <div className="text-cyan-300 text-sm bg-cyan-950/40 border border-cyan-900 rounded p-2">
            {statusMessage}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !client}
            className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2 rounded transition-colors"
          >
            {creating ? "Creating..." : "Create Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
