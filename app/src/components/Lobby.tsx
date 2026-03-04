"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_ID, MatchStatus } from "@sdk";
import CreateMatchModal from "./CreateMatchModal";
import { useGameClient } from "@/hooks/useGameClient";

interface MatchEntry {
  matchId: string;
  status: number;
  playerCount: number;
  turn: number;
  players: number;
}

export default function Lobby() {
  const client = useGameClient();
  const { connection } = useConnection();
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [manualId, setManualId] = useState("");

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: 522 }], // GalaxyMatch::SPACE
      });

      const entries: MatchEntry[] = [];
      for (const { account } of accounts) {
        try {
          // Parse minimal fields from raw account data
          // Discriminator: 8 bytes, then matchId: 8 bytes (u64 LE)
          const data = account.data;
          const matchId = data.readBigUInt64LE(8).toString();
          // authority: 32 bytes at offset 16
          // players: 4 * 32 = 128 bytes at offset 48
          const playerCount = data[176]; // after 8 + 8 + 32 + 128
          const turn = data[177];
          const status = data[178];

          // Count non-default players
          let registeredPlayers = 0;
          for (let i = 0; i < 4; i++) {
            const start = 48 + i * 32;
            const isDefault = data.slice(start, start + 32).every((b: number) => b === 0);
            if (!isDefault) registeredPlayers++;
          }

          entries.push({
            matchId,
            status,
            playerCount,
            turn,
            players: registeredPlayers,
          });
        } catch {
          // skip unparseable accounts
        }
      }

      // Sort: active first, then waiting, then completed
      entries.sort((a, b) => {
        if (a.status !== b.status) return a.status - b.status;
        return Number(BigInt(b.matchId) - BigInt(a.matchId));
      });

      setMatches(entries);
    } catch (err) {
      console.error("Failed to load matches:", err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const statusBadge = (status: number) => {
    switch (status) {
      case MatchStatus.WaitingForPlayers:
        return <span className="bg-yellow-800 text-yellow-200 px-2 py-0.5 rounded text-xs">Waiting</span>;
      case MatchStatus.Active:
        return <span className="bg-green-800 text-green-200 px-2 py-0.5 rounded text-xs">Active</span>;
      case MatchStatus.Completed:
        return <span className="bg-purple-800 text-purple-200 px-2 py-0.5 rounded text-xs">Completed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Matches</h2>
        <div className="flex gap-2">
          <button
            onClick={loadMatches}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!client}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded transition-colors font-medium"
          >
            Create Match
          </button>
        </div>
      </div>

      {/* Direct match ID entry */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter Match ID to join..."
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-500"
        />
        <Link
          href={manualId ? `/match/${manualId}` : "#"}
          className={`bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm ${
            !manualId ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Go
        </Link>
      </div>

      {/* Match list */}
      {matches.length === 0 && !loading && (
        <div className="text-gray-500 text-center py-8">
          No matches found. Create one to get started!
        </div>
      )}

      <div className="space-y-2">
        {matches.map((m) => (
          <Link
            key={m.matchId}
            href={`/match/${m.matchId}`}
            className="block bg-gray-900 border border-gray-700 hover:border-gray-500 rounded p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white font-mono text-sm">
                  Match #{m.matchId}
                </span>
                <span className="ml-3">{statusBadge(m.status)}</span>
              </div>
              <div className="text-gray-400 text-sm space-x-4">
                <span>Players: {m.players}/{m.playerCount}</span>
                <span>Turn: {m.turn}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <CreateMatchModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
