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
          <span className="border border-[#996800] bg-[rgba(255,176,0,0.04)] px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#ffb000]">
            Waiting
          </span>
        );
      case MatchStatus.Active:
        return (
          <span className="border border-[#0c6d1f] bg-[rgba(0,255,65,0.04)] px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#00ff41]">
            Active
          </span>
        );
      case MatchStatus.Completed:
        return (
          <span className="border border-[#005f52] bg-[rgba(0,229,204,0.04)] px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-[#00e5cc]">
            Complete
          </span>
        );
      default:
        return null;
    }
  };

  const quickMatch = matches.find(
    (match) => match.status === MatchStatus.WaitingForPlayers,
  );

  return (
    <div className="space-y-2">
      <Toast message={error} tone="error" />

      {quickMatch && (
        <Link
          href={`/match/${quickMatch.matchId}`}
          className="block border border-[#996800] bg-[rgba(255,176,0,0.03)] px-4 py-3 text-center text-[10px] uppercase tracking-[0.24em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.08)]"
        >
          Quick Match — Join Open Lobby
        </Link>
      )}

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="border border-[#0e2a0e] bg-[#030d03] p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-[0.34em] text-[#0c6d1f]">
                Match Feed
              </div>
              <div className="mt-1 font-[family-name:var(--font-vt323)] text-3xl tracking-[0.16em] text-[#00ff41]">
                ACTIVE SIGNALS
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
                className="border border-[#005f52] bg-[rgba(0,229,204,0.03)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00e5cc] hover:bg-[rgba(0,229,204,0.08)]"
              >
                Demo Match
              </Link>
              <button
                onClick={loadMatches}
                disabled={loading}
                className="border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-40"
              >
                {loading ? "Syncing" : "Refresh"}
              </button>
              <button
                onClick={() => setShowCreate(true)}
                disabled={!client}
                className="border border-[#996800] bg-[rgba(255,176,0,0.03)] px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-[#ffb000] hover:bg-[rgba(255,176,0,0.08)] disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Link
              href={`/match/${DEMO_MATCH_ID.toString()}?demo=1`}
              className="block border border-[#005f52] bg-[rgba(0,229,204,0.02)] px-4 py-3 hover:bg-[rgba(0,229,204,0.05)]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.24em] text-[#00786b]">
                    Demo scenario
                  </div>
                  <div className="mt-1 font-mono text-sm text-[#00e5cc]">
                    Match #{DEMO_MATCH_ID.toString()}
                  </div>
                </div>
                <div className="text-xs uppercase tracking-[0.14em] text-[#008f7f]">
                  Simulated full UI loop
                </div>
              </div>
            </Link>

            {matches.length === 0 && !loading && (
              <div className="border border-dashed border-[#0e2a0e] px-4 py-8 text-center text-xs uppercase tracking-[0.2em] text-[#0c6d1f]">
                No live matches detected
              </div>
            )}

            {matches.map((m) => (
              <Link
                key={m.matchId}
                href={`/match/${m.matchId}`}
                className="block border border-[#0e2a0e] bg-[#021202] px-4 py-3 hover:border-[#0c6d1f] hover:bg-[#031703]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="font-mono text-sm text-[#00cc33]">
                      Match #{m.matchId}
                    </span>
                    <span className="ml-0 mt-2 inline-block sm:ml-3 sm:mt-0">
                      {statusBadge(m.status)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] uppercase tracking-[0.14em] text-[#0c6d1f]">
                    <span>Players {m.players}/{m.playerCount}</span>
                    <span>Turn {m.turn}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="border border-[#0e2a0e] bg-[#030d03] p-4">
          <div className="text-[9px] uppercase tracking-[0.34em] text-[#0c6d1f]">
            Direct access
          </div>
          <div className="mt-2 font-[family-name:var(--font-vt323)] text-3xl tracking-[0.16em] text-[#ffb000]">
            QUICK JOIN
          </div>
          <p className="mt-3 text-xs leading-6 text-[#00aa2a]">
            Paste a match ID to open a battlefield directly, or use the demo
            channel for a guided showcase.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Enter Match ID..."
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="border border-[#0e2a0e] bg-[#021202] px-3 py-3 text-sm text-[#00ff41] placeholder:text-[#0c6d1f] focus:border-[#0c6d1f] focus:outline-none"
            />
            <Link
              href={manualId ? `/match/${manualId}` : "#"}
              className={`border border-[#0c6d1f] bg-[rgba(0,255,65,0.03)] px-4 py-3 text-center text-[10px] uppercase tracking-[0.24em] text-[#00ff41] hover:bg-[rgba(0,255,65,0.08)] ${
                !manualId ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Open Match
            </Link>
          </div>
        </div>
      </div>

      <CreateMatchModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
