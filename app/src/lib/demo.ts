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

// ---------------------------------------------------------------------------
// Seeded PRNG (deterministic per-turn randomness that still feels varied)
// ---------------------------------------------------------------------------
function seededRandom(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

// ---------------------------------------------------------------------------
// Richer map generation - faction territories expand/contract per turn
// ---------------------------------------------------------------------------
function makeMap(turn: number): number[] {
  const rand = seededRandom(turn * 7919 + 31);
  const tiles = Array.from({ length: MAP_SIZE * MAP_SIZE }, () => 0);

  // Seed player 1 base (top-left quadrant)
  tiles[0] = 1;
  tiles[1] = 1;
  tiles[MAP_SIZE] = 1;

  // Seed player 2 base (bottom-right quadrant)
  tiles[tiles.length - 1] = 2;
  tiles[tiles.length - 2] = 2;
  tiles[tiles.length - 1 - MAP_SIZE] = 2;

  // Expand territories based on turn
  for (let pass = 0; pass < turn; pass++) {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] !== 0) continue;
      const x = i % MAP_SIZE;
      const y = Math.floor(i / MAP_SIZE);
      const neighbors = [
        y > 0 ? tiles[i - MAP_SIZE] : 0,
        y < MAP_SIZE - 1 ? tiles[i + MAP_SIZE] : 0,
        x > 0 ? tiles[i - 1] : 0,
        x < MAP_SIZE - 1 ? tiles[i + 1] : 0,
      ];
      const p1Adjacent = neighbors.filter((n) => n === 1).length;
      const p2Adjacent = neighbors.filter((n) => n === 2).length;
      if (p1Adjacent > 0 && rand() < 0.25 + p1Adjacent * 0.1) tiles[i] = 1;
      else if (p2Adjacent > 0 && rand() < 0.25 + p2Adjacent * 0.1) tiles[i] = 2;
    }
  }

  // Contested zones (owner=3) where territories overlap
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 0) continue;
    const x = i % MAP_SIZE;
    const y = Math.floor(i / MAP_SIZE);
    const adj = [
      y > 0 ? tiles[i - MAP_SIZE] : 0,
      y < MAP_SIZE - 1 ? tiles[i + MAP_SIZE] : 0,
      x > 0 ? tiles[i - 1] : 0,
      x < MAP_SIZE - 1 ? tiles[i + 1] : 0,
    ];
    const hasEnemy =
      (tiles[i] === 1 && adj.includes(2)) ||
      (tiles[i] === 2 && adj.includes(1));
    if (hasEnemy && rand() < 0.35) tiles[i] = 3;
  }

  // Sprinkle some destroyed sectors (owner=4) from past battles
  if (turn > 1) {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === 3 && rand() < 0.2) tiles[i] = 4;
    }
  }

  // Ensure bases stay
  tiles[0] = 1;
  tiles[tiles.length - 1] = 2;
  return tiles;
}

// ---------------------------------------------------------------------------
// Randomized battle summary
// ---------------------------------------------------------------------------
function makeBattleSummary(turn: number, winner = NO_WINNER): number[] {
  const rand = seededRandom(turn * 4217 + 13);
  const p1Destroyed = Math.floor(rand() * Math.min(turn, 3));
  const p2Destroyed = Math.floor(rand() * Math.min(turn, 3));
  const p1CmdAlive = rand() > 0.15 ? 1 : 0;
  const p2CmdAlive = rand() > 0.15 ? 1 : 0;
  return [
    winner,
    p1Destroyed,
    p2Destroyed,
    0,
    0,
    p1CmdAlive,
    p2CmdAlive,
    0,
    0,
    turn + 1,
  ];
}

// ---------------------------------------------------------------------------
// Demo match lifecycle
// ---------------------------------------------------------------------------

export function createDemoMatch(matchId: bigint = DEMO_MATCH_ID): GalaxyMatch {
  return {
    matchId: new BN(matchId.toString()),
    authority: PROGRAM_ID,
    players: DEMO_PLAYERS,
    playerCount: 2,
    turn: 1,
    status: MatchStatus.Active,
    mapSeed: new BN(42),
    revealedSectorOwner: makeMap(1),
    battleSummary: makeBattleSummary(1),
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
  const winner = nextTurn >= 8 ? 0 : NO_WINNER;
  return {
    ...match,
    turn: nextTurn,
    status: winner === NO_WINNER ? MatchStatus.Active : MatchStatus.Completed,
    battleSummary: makeBattleSummary(nextTurn, winner),
    submittedOrders: [0, 0, 0, 0],
    revealedSectorOwner: makeMap(nextTurn),
  };
}

export function markDemoOrdersSubmitted(
  match: GalaxyMatch,
  playerOrder?: { targetX: number; targetY: number; action: number },
): GalaxyMatch {
  // Smarter AI: respond to the player's action
  if (playerOrder) {
    const rand = seededRandom(
      match.turn * 3331 + playerOrder.targetX * 7 + playerOrder.targetY,
    );
    const map = [...match.revealedSectorOwner];
    const targetIdx = playerOrder.targetY * MAP_SIZE + playerOrder.targetX;

    // If player attacks, AI has a chance to reinforce or counter-attack nearby
    if (playerOrder.action === 2) {
      // AI reinforces a random adjacent cell
      const adjacent = [
        targetIdx - MAP_SIZE,
        targetIdx + MAP_SIZE,
        targetIdx - 1,
        targetIdx + 1,
      ].filter((i) => i >= 0 && i < map.length);
      const pick = adjacent[Math.floor(rand() * adjacent.length)];
      if (pick !== undefined && map[pick] === 0) {
        map[pick] = 2;
      }
    } else {
      // AI scouts or pushes forward toward player territory
      for (let i = 0; i < map.length; i++) {
        if (map[i] === 0 && rand() < 0.12) {
          map[i] = 2;
          break;
        }
      }
    }

    // Ensure bases stay
    map[0] = 1;
    map[map.length - 1] = 2;

    return {
      ...match,
      submittedOrders: [1, 1, 0, 0],
      revealedSectorOwner: map,
    };
  }

  return {
    ...match,
    submittedOrders: [1, 1, 0, 0],
  };
}

export function getDemoUnitPositions(
  turn: number,
): { slot: number; x: number; y: number }[] {
  const rand = seededRandom(turn * 2003 + 41);
  const units: { slot: number; x: number; y: number }[] = [];

  for (let i = 0; i < 4; i++) {
    units.push({
      slot: i,
      x: Math.min(MAP_SIZE - 1, Math.floor(rand() * (MAP_SIZE / 2 + turn * 0.3))),
      y: Math.min(MAP_SIZE - 1, Math.floor(rand() * (MAP_SIZE / 2 + turn * 0.2))),
    });
  }

  for (let i = 4; i < 8; i++) {
    units.push({
      slot: i,
      x: Math.max(
        0,
        MAP_SIZE - 1 - Math.floor(rand() * (MAP_SIZE / 2 + turn * 0.3)),
      ),
      y: Math.max(
        0,
        MAP_SIZE - 1 - Math.floor(rand() * (MAP_SIZE / 2 + turn * 0.2)),
      ),
    });
  }

  return units;
}

export function buildDemoVisibilityReport(turn: number): DecodedVisibilityReport {
  const rand = seededRandom(turn * 1301 + 7);
  const numContacts = 1 + Math.floor(rand() * 3);
  const units = Array.from({ length: numContacts }, (_, i) => ({
    slot: 4 + i,
    x: Math.floor(rand() * MAP_SIZE),
    y: Math.floor(rand() * MAP_SIZE),
  }));

  return {
    visibleSlots: units.map((u) => u.slot),
    units,
  };
}

export function isDemoMatchId(matchId: bigint | null): boolean {
  return matchId === DEMO_MATCH_ID;
}

// ---------------------------------------------------------------------------
// Demo turn history (for replay feature)
// ---------------------------------------------------------------------------

const DEMO_HISTORY_KEY = "fog-of-war-demo-history";

export interface DemoSnapshot {
  turn: number;
  revealedSectorOwner: number[];
  battleSummary: number[];
  timestamp: number;
}

export function saveDemoSnapshot(match: GalaxyMatch): void {
  try {
    const existing = loadDemoHistory();
    if (existing.some((s) => s.turn === match.turn)) return;

    const snapshot: DemoSnapshot = {
      turn: match.turn,
      revealedSectorOwner: [...match.revealedSectorOwner],
      battleSummary: [...match.battleSummary],
      timestamp: Date.now(),
    };

    const updated = [...existing, snapshot].slice(-20);
    localStorage.setItem(DEMO_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export function loadDemoHistory(): DemoSnapshot[] {
  try {
    const raw = localStorage.getItem(DEMO_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DemoSnapshot[];
  } catch {
    return [];
  }
}

export function clearDemoHistory(): void {
  try {
    localStorage.removeItem(DEMO_HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Tutorial steps
// ---------------------------------------------------------------------------

export interface TutorialStep {
  id: string;
  title: string;
  message: string;
  highlight?: "board" | "orders" | "resolve" | "visibility";
}

const TUTORIAL_KEY = "fog-of-war-tutorial-done";

export function isTutorialDone(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {
    // ignore
  }
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "WELCOME, COMMANDER",
    message:
      "This is a simulated battlefield. You'll learn how to issue orders, resolve turns, and request intel.",
  },
  {
    id: "select-sector",
    title: "SELECT A SECTOR",
    message:
      "Click any cell on the grid to designate your target sector. Green cells are yours, amber are the enemy.",
    highlight: "board",
  },
  {
    id: "submit-order",
    title: "ISSUE AN ORDER",
    message:
      "Use the order panel to choose an action - Move, Scout, or Attack - then submit your encrypted order.",
    highlight: "orders",
  },
  {
    id: "resolve-turn",
    title: "RESOLVE THE TURN",
    message:
      "Once both sides have locked in orders, hit Resolve Turn to process combat and advance the timeline.",
    highlight: "resolve",
  },
  {
    id: "visibility",
    title: "REQUEST INTEL",
    message:
      "Scout reports reveal hidden enemy positions. Use the Visibility Report to update your tactical picture.",
    highlight: "visibility",
  },
];
