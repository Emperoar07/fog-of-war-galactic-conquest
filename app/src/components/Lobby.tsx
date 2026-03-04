"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { PROGRAM_ID, MatchStatus } from "@sdk";
import CreateMatchModal from "./CreateMatchModal";
import Toast from "./Toast";
import { useGameClient } from "@/hooks/useGameClient";
import { DEMO_MATCH_ID } from "@/lib/demo";

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
  const [error, setError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: 522 }],
      });

      const entries: MatchEntry[] = [];
      for (const { account } of accounts) {
        try {
          const data = account.data;
          const matchId = data.readBigUInt64LE(8).toString();
          const playerCount = data[176];
          const turn = data[177];
          const status = data[178];

          let registeredPlayers = 0;
          for (let i = 0; i < 4; i++) {
            const start = 48 + i * 32;
            const isDefault = data
              .slice(start, start + 32)
              .every((b: number) => b === 0);
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

      entries.sort((a, b) => {
        if (a.status !== b.status) return a.status - b.status;
        return Number(BigInt(b.matchId) - BigInt(a.matchId));
      });

      setMatches(entries);
    } catch (err: unknown) {
      console.error("Failed to load matches:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load matches from devnet.",
      );
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
        return (
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
            Waiting
          </span>
        );
      case MatchStatus.Active:
        return (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
            Active
          </span>
        );
      case MatchStatus.Completed:
        return (
          <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs text-purple-700">
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Toast message={error} tone="error" />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Command Lobby
            </p>
            <h2 className="text-3xl font-bold text-slate-900">Matches</h2>
            <p className="max-w-xl text-sm text-slate-500">
              Browse live devnet battles or open a fully simulated demo match
              while MXE is unavailable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Open Demo Match
            </Link>
            <button
              onClick={loadMatches}
              disabled={loading}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              {loading ? "Syncing..." : "Refresh"}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              disabled={!client}
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              Create Match
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Active Signals
            </h3>
            {loading && (
              <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                syncing
              </span>
            )}
          </div>

          <div className="space-y-3">
            <Link
              href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
              className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Demo Scenario
                  </div>
                  <div className="mt-1 font-mono text-sm text-slate-800">
                    Match #{DEMO_MATCH_ID.toString()}
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  Full UI loop with simulated turns
                </div>
              </div>
            </Link>

            {matches.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-400">
                No live matches found. Launch a demo or create one to get started.
              </div>
            )}

            {matches.map((m) => (
              <Link
                key={m.matchId}
                href={`/match/${m.matchId}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-mono text-sm text-slate-800">
                      Match #{m.matchId}
                    </span>
                    <span className="ml-0 mt-2 inline-block sm:ml-3 sm:mt-0">
                      {statusBadge(m.status)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span>Players: {m.players}/{m.playerCount}</span>
                    <span>Turn: {m.turn}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            Quick Join
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Paste a match ID to jump directly into a battlefield.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Enter Match ID to join..."
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
            />
            <Link
              href={manualId ? `/match/${manualId}` : "#"}
              className={`rounded-lg bg-slate-100 px-4 py-2 text-center text-sm text-slate-700 transition-colors hover:bg-slate-200 ${
                !manualId ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Go to Match
            </Link>
          </div>
        </div>
      </div>

      <CreateMatchModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
