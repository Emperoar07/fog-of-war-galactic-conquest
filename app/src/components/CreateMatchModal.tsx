"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameClient } from "@/hooks/useGameClient";
import { useSound } from "@/components/SoundProvider";

interface CreateMatchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateMatchModal({
  open,
  onClose,
}: CreateMatchModalProps) {
  const client = useGameClient();
  const { playSound } = useSound();
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
    playSound("uplink");
    try {
      const matchId = BigInt(Math.floor(Math.random() * 1_000_000_000));
      const result = await client.createMatch(matchId, 2, BigInt(mapSeed || "42"));
      setStatusMessage("Match queued. Waiting for callback completion...");
      await client.awaitComputation(result.computationOffset);
      setStatusMessage("Match ready. Opening battlefield...");
      playSound("success");
      router.push(`/match/${matchId.toString()}`);
      onClose();
    } catch (err: unknown) {
      playSound("error");
      setError(err instanceof Error ? err.message : "Failed to create match");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md border border-[#0c6d1f] bg-[#030d03] p-6 shadow-[0_0_40px_rgba(0,255,65,0.08)]">
        <h2 className="font-[family-name:var(--font-vt323)] text-4xl tracking-[0.16em] text-[#00ff41]">
          NEW MATCH
        </h2>

        <div className="mt-4">
          <label className="mb-1 block text-[9px] uppercase tracking-[0.24em] text-[#0c6d1f]">
            Map Seed
          </label>
          <input
            type="number"
            value={mapSeed}
            onChange={(e) => setMapSeed(e.target.value)}
            disabled={creating}
            className="w-full border border-[#0e2a0e] bg-[#021202] px-3 py-3 text-sm text-[#00ff41] disabled:opacity-40"
          />
        </div>

        <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#0c6d1f]">
          2-player match // you deploy as Player 1
        </div>

        {error && (
          <div className="mt-4 border border-[#881111] bg-[rgba(255,51,51,0.03)] p-3 text-[10px] uppercase tracking-[0.16em] text-[#ff3333]">
            {error}
          </div>
        )}

        {statusMessage && !error && (
          <div className="mt-4 border border-[#005f52] bg-[rgba(0,229,204,0.03)] p-3 text-[10px] uppercase tracking-[0.16em] text-[#00e5cc]">
            {statusMessage}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            data-sound-manual="true"
            onClick={() => {
              playSound("uiTap");
              onClose();
            }}
            disabled={creating}
            className="flex-1 border border-[#0e2a0e] bg-[#021202] py-3 text-[10px] uppercase tracking-[0.22em] text-[#00aa2a] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            data-sound-manual="true"
            onClick={handleCreate}
            disabled={creating || !client}
            className="flex-1 border border-[#996800] bg-[rgba(255,176,0,0.04)] py-3 text-[10px] uppercase tracking-[0.22em] text-[#ffb000] disabled:opacity-40"
          >
            {creating ? "Deploying..." : "Deploy Fleet"}
          </button>
        </div>
      </div>
    </div>
  );
}
