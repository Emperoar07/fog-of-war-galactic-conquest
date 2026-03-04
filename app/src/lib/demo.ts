"use client";

import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  ARCIUM_PROGRAM_ID,
  MAP_SIZE,
  MatchStatus,
  NO_WINNER,
  PROGRAM_ID,
  type DecodedVisibilityReport,
  type GalaxyMatch,
} from "@sdk";

export const DEMO_MATCH_ID = BigInt("900000001");
export const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

const EMPTY_PLAYER = PublicKey.default;
const DEMO_PLAYERS = [PROGRAM_ID, ARCIUM_PROGRAM_ID, EMPTY_PLAYER, EMPTY_PLAYER];

function makeBattleSummary(turn: number, winner = NO_WINNER): number[] {
  return [
    winner,
    0,
    turn % 2,
    0,
    0,
    1,
    1,
    0,
    0,
    turn + 1,
  ];
}

function makeMap(turn: number): number[] {
  const tiles = Array.from({ length: MAP_SIZE * MAP_SIZE }, () => 0);
  for (let i = 0; i < tiles.length; i++) {
    const x = i % MAP_SIZE;
    const y = Math.floor(i / MAP_SIZE);
    if ((x + y + turn) % 5 === 0) tiles[i] = 1;
    if ((x * 2 + y + turn) % 7 === 0) tiles[i] = 2;
  }
  tiles[0] = 1;
  tiles[tiles.length - 1] = 2;
  return tiles;
}

export function createDemoMatch(matchId: bigint = DEMO_MATCH_ID): GalaxyMatch {
  return {
    matchId: new BN(matchId.toString()),
    authority: PROGRAM_ID,
    players: DEMO_PLAYERS,
    playerCount: 2,
    turn: 3,
    status: MatchStatus.Active,
    mapSeed: new BN(42),
    revealedSectorOwner: makeMap(3),
    battleSummary: makeBattleSummary(3),
    submittedOrders: [0, 0, 0, 0],
    hiddenState: Array.from({ length: 5 }, () => [0]),
    hiddenStateNonce: new BN(0),
    lastVisibility: Array.from({ length: 2 }, () => [0]),
    lastVisibilityNonce: new BN(0),
    lastVisibilityViewer: 0,
  };
}

export function advanceDemoTurn(match: GalaxyMatch): GalaxyMatch {
  const nextTurn = match.turn + 1;
  const winner = nextTurn >= 6 ? 0 : NO_WINNER;
  return {
    ...match,
    turn: nextTurn,
    status: winner === NO_WINNER ? MatchStatus.Active : MatchStatus.Completed,
    battleSummary: makeBattleSummary(nextTurn, winner),
    submittedOrders: [0, 0, 0, 0],
    revealedSectorOwner: makeMap(nextTurn),
  };
}

export function markDemoOrdersSubmitted(match: GalaxyMatch): GalaxyMatch {
  return {
    ...match,
    submittedOrders: [1, 1, 0, 0],
  };
}

export function buildDemoVisibilityReport(turn: number): DecodedVisibilityReport {
  return {
    visibleSlots: [4, 5],
    units: [
      { slot: 4, x: (turn + 2) % MAP_SIZE, y: (turn + 4) % MAP_SIZE },
      { slot: 5, x: (turn + 5) % MAP_SIZE, y: (turn + 1) % MAP_SIZE },
    ],
  };
}

export function isDemoMatchId(matchId: bigint | null): boolean {
  return matchId === DEMO_MATCH_ID;
}
