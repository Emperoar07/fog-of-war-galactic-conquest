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
export const QUICK_MATCH_IDS = {
  easy: BigInt("900000101"),
  medium: BigInt("900000102"),
  hard: BigInt("900000103"),
} as const;
export const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export type AiDifficulty = "easy" | "medium" | "hard";

const EMPTY_PLAYER = PublicKey.default;
const DEMO_PLAYERS = [PROGRAM_ID, ARCIUM_PROGRAM_ID, EMPTY_PLAYER, EMPTY_PLAYER];

type AiProfile = {
  label: string;
  lockDelayMs: number;
  tacticalDepth: number;
  aggression: number;
  caution: number;
  reinforcementBurst: number;
  moveBudgetMin: number;
  moveBudgetMax: number;
  waveCount: number;
  interiorReinforcementChance: number;
  expansionChance: number;
  contestedPushChance: number;
  winnerTurn: number;
  preferredWinner: 0 | 1;
};

const AI_PROFILES: Record<AiDifficulty, AiProfile> = {
  easy: {
    label: "Easy",
    lockDelayMs: 1400,
    tacticalDepth: 1,
    aggression: 0.2,
    caution: 0.8,
    reinforcementBurst: 1,
    moveBudgetMin: 1,
    moveBudgetMax: 2,
    waveCount: 1,
    interiorReinforcementChance: 0.08,
    expansionChance: 0.08,
    contestedPushChance: 0.2,
    winnerTurn: 8,
    preferredWinner: 0,
  },
  medium: {
    label: "Medium",
    lockDelayMs: 900,
    tacticalDepth: 2,
    aggression: 0.45,
    caution: 0.5,
    reinforcementBurst: 2,
    moveBudgetMin: 2,
    moveBudgetMax: 4,
    waveCount: 2,
    interiorReinforcementChance: 0.16,
    expansionChance: 0.12,
    contestedPushChance: 0.35,
    winnerTurn: 9,
    preferredWinner: 1,
  },
  hard: {
    label: "Hard",
    lockDelayMs: 500,
    tacticalDepth: 3,
    aggression: 0.72,
    caution: 0.25,
    reinforcementBurst: 3,
    moveBudgetMin: 3,
    moveBudgetMax: 6,
    waveCount: 3,
    interiorReinforcementChance: 0.24,
    expansionChance: 0.18,
    contestedPushChance: 0.55,
    winnerTurn: 9,
    preferredWinner: 1,
  },
};

function toIndex(x: number, y: number): number {
  return y * MAP_SIZE + x;
}

function fromIndex(index: number): { x: number; y: number } {
  return { x: index % MAP_SIZE, y: Math.floor(index / MAP_SIZE) };
}

function neighbors(index: number): number[] {
  const { x, y } = fromIndex(index);
  return [
    y > 0 ? toIndex(x, y - 1) : -1,
    y < MAP_SIZE - 1 ? toIndex(x, y + 1) : -1,
    x > 0 ? toIndex(x - 1, y) : -1,
    x < MAP_SIZE - 1 ? toIndex(x + 1, y) : -1,
  ].filter((i) => i >= 0);
}

// ---------------------------------------------------------------------------
// Board analysis helpers
// ---------------------------------------------------------------------------

interface BoardAnalysis {
  aiTiles: number[];       // indices owned by AI (owner=2)
  playerTiles: number[];   // indices owned by player (owner=1)
  contested: number[];     // indices that are contested (owner=3)
  neutral: number[];       // indices that are empty (owner=0)
  aiFrontier: number[];    // neutral/player/contested tiles adjacent to AI territory
  playerFrontier: number[];// neutral/AI/contested tiles adjacent to player territory
  aiTerritory: number;
  playerTerritory: number;
  borderPressure: Map<number, number>; // index → count of enemy-adjacent edges
}

function analyzeBoard(map: number[]): BoardAnalysis {
  const aiTiles: number[] = [];
  const playerTiles: number[] = [];
  const contested: number[] = [];
  const neutral: number[] = [];
  const aiFrontierSet = new Set<number>();
  const playerFrontierSet = new Set<number>();
  const borderPressure = new Map<number, number>();

  for (let i = 0; i < map.length; i++) {
    switch (map[i]) {
      case 1: playerTiles.push(i); break;
      case 2: aiTiles.push(i); break;
      case 3: contested.push(i); break;
      case 0: neutral.push(i); break;
    }
  }

  // Build frontiers: tiles reachable from each side's territory
  for (const idx of aiTiles) {
    for (const n of neighbors(idx)) {
      if (map[n] !== 2 && map[n] !== 4) aiFrontierSet.add(n);
    }
  }
  for (const idx of playerTiles) {
    for (const n of neighbors(idx)) {
      if (map[n] !== 1 && map[n] !== 4) playerFrontierSet.add(n);
    }
  }

  // Border pressure: how many enemy neighbors each AI tile has
  for (const idx of aiTiles) {
    const enemyNeighbors = neighbors(idx).filter((n) => map[n] === 1 || map[n] === 3).length;
    if (enemyNeighbors > 0) borderPressure.set(idx, enemyNeighbors);
  }

  return {
    aiTiles,
    playerTiles,
    contested,
    neutral,
    aiFrontier: Array.from(aiFrontierSet),
    playerFrontier: Array.from(playerFrontierSet),
    aiTerritory: aiTiles.length,
    playerTerritory: playerTiles.length,
    borderPressure,
  };
}

// ---------------------------------------------------------------------------
// Move types and scoring
// ---------------------------------------------------------------------------

interface AiMove {
  index: number;
  newOwner: number;  // what the tile becomes (2=AI, 3=contested)
  score: number;
  type: "expand" | "contest" | "capture" | "defend";
}

function generateMoves(
  map: number[],
  analysis: BoardAnalysis,
  profile: AiProfile,
  playerOrder: { targetX: number; targetY: number; action: number },
): AiMove[] {
  const moves: AiMove[] = [];
  const playerTarget = toIndex(playerOrder.targetX, playerOrder.targetY);

  for (const idx of analysis.aiFrontier) {
    const tile = map[idx];
    if (tile === 4) continue; // skip destroyed

    const adj = neighbors(idx);
    const aiAdj = adj.filter((n) => map[n] === 2).length;
    const playerAdj = adj.filter((n) => map[n] === 1).length;
    const dist = gridDistance(idx, playerTarget);

    if (tile === 0) {
      // Expand into neutral
      let score = 1.0 + aiAdj * 0.6;
      // Prefer tiles that block player expansion
      if (analysis.playerFrontier.includes(idx)) score += 1.2;
      // Slight preference for center tiles
      const { x, y } = fromIndex(idx);
      const cx = Math.abs(x - (MAP_SIZE - 1) / 2);
      const cy = Math.abs(y - (MAP_SIZE - 1) / 2);
      score += Math.max(0, 2 - (cx + cy) * 0.3);
      moves.push({ index: idx, newOwner: 2, score, type: "expand" });
    }

    if (tile === 1) {
      // Capture enemy territory
      let score = 2.0 + profile.aggression * 2.5;
      score += aiAdj * 0.8; // backed by AI territory
      score -= playerAdj * 0.5 * profile.caution; // risk from player presence
      // React to player's attack: counter near their target
      if (playerOrder.action === 2 && dist <= 2) score += 1.5;
      moves.push({ index: idx, newOwner: 2, score, type: "capture" });
    }

    if (tile === 3) {
      // Resolve contested in AI's favor
      let score = 1.8 + profile.aggression * 1.5;
      score += aiAdj * 0.5;
      moves.push({ index: idx, newOwner: 2, score, type: "contest" });
    }
  }

  // Defensive moves: contest tiles where player is pushing into AI territory
  for (const [idx, pressure] of analysis.borderPressure) {
    if (pressure >= 2) {
      // Reinforce threatened border by contesting adjacent enemy tiles
      for (const n of neighbors(idx)) {
        if (map[n] === 1) {
          let score = 1.5 + pressure * 0.8 + profile.caution * 2.0;
          // Higher priority if player is actively attacking nearby
          const dist = gridDistance(n, playerTarget);
          if (playerOrder.action === 2 && dist <= 2) score += 2.0;
          moves.push({ index: n, newOwner: 3, score, type: "defend" });
        }
      }
    }
  }

  return moves;
}

function gridDistance(a: number, b: number): number {
  const pa = fromIndex(a);
  const pb = fromIndex(b);
  return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
}

// ---------------------------------------------------------------------------
// Difficulty-specific move selection
// ---------------------------------------------------------------------------

function applyAiTurnByDifficulty(
  map: number[],
  profile: AiProfile,
  playerOrder: { targetX: number; targetY: number; action: number },
  rand: () => number,
): number[] {
  const next = [...map];
  const usedIndices = new Set<number>();

  const baseBudget = profile.moveBudgetMin;
  const extraBudget = Math.floor(
    rand() * Math.max(1, profile.moveBudgetMax - profile.moveBudgetMin + 1),
  );
  const budget = baseBudget + extraBudget;
  let remaining = budget;

  for (let wave = 0; wave < profile.waveCount && remaining > 0; wave++) {
    const analysis = analyzeBoard(next);
    const allMoves = generateMoves(next, analysis, profile, playerOrder);
    if (allMoves.length === 0) break;

    allMoves.sort((a, b) => b.score - a.score);

    // Difficulty-specific shaping within each wave
    let pool = allMoves;
    if (profile.label === "Easy") {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      pool = pool.filter((m) => {
        if (m.type === "capture") return rand() < 0.12;
        if (m.type === "contest") return rand() < 0.3;
        return true;
      });
      if (pool.length === 0) pool = allMoves.slice(0, 2);
    } else if (profile.label === "Medium") {
      const topCount = Math.max(3, Math.ceil(pool.length * 0.6));
      pool = pool.slice(0, topCount);
      for (let i = pool.length - 1; i > 1; i--) {
        if (rand() < 0.35) {
          const j = Math.floor(rand() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }
    } else {
      // Hard mode re-prioritizes counters near player target and frontier blocking.
      const playerTarget = toIndex(playerOrder.targetX, playerOrder.targetY);
      for (const move of pool) {
        if (gridDistance(move.index, playerTarget) <= 2) {
          move.score += 1.2;
        }
        if (analysis.playerFrontier.includes(move.index) && move.type === "expand") {
          move.score += 0.9;
        }
      }
      pool.sort((a, b) => b.score - a.score);
    }

    const perWaveBudget = Math.max(
      1,
      Math.min(remaining, Math.ceil(budget / profile.waveCount)),
    );
    let waveApplied = 0;
    for (const move of pool) {
      if (waveApplied >= perWaveBudget || remaining <= 0) break;
      if (usedIndices.has(move.index)) continue;
      next[move.index] = move.newOwner;
      usedIndices.add(move.index);
      waveApplied++;
      remaining--;
    }

    // Interior reinforcement: deepen control behind the frontier.
    if (remaining > 0) {
      const postAnalysis = analyzeBoard(next);
      const interior = postAnalysis.aiTiles.filter((idx) => {
        const adj = neighbors(idx);
        return adj.every((n) => next[n] === 2 || next[n] === 4);
      });
      for (const idx of interior) {
        if (remaining <= 0) break;
        if (rand() > profile.interiorReinforcementChance) continue;
        const ring = neighbors(idx).filter((n) => next[n] === 0 || next[n] === 3);
        if (ring.length === 0) continue;
        const pick = ring[Math.floor(rand() * ring.length)];
        if (usedIndices.has(pick)) continue;
        next[pick] = 2;
        usedIndices.add(pick);
        remaining--;
      }
    }
  }

  return next;
}

export function parseAiDifficulty(value: string | null): AiDifficulty | null {
  return value === "easy" || value === "medium" || value === "hard" ? value : null;
}

export function getQuickMatchDifficulty(matchId: bigint | null): AiDifficulty | null {
  if (matchId === QUICK_MATCH_IDS.easy) return "easy";
  if (matchId === QUICK_MATCH_IDS.medium) return "medium";
  if (matchId === QUICK_MATCH_IDS.hard) return "hard";
  return null;
}

export function getAiProfile(difficulty: AiDifficulty): AiProfile {
  return AI_PROFILES[difficulty];
}

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

export function createLocalMatch(
  matchId: bigint = DEMO_MATCH_ID,
  aiDifficulty: AiDifficulty | null = null,
): GalaxyMatch {
  return {
    matchId: new BN(matchId.toString()),
    authority: PROGRAM_ID,
    players: DEMO_PLAYERS,
    playerCount: 2,
    turn: 1,
    status: MatchStatus.Active,
    mapSeed: new BN(aiDifficulty ? 84 : 42),
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

export function createDemoMatch(matchId: bigint = DEMO_MATCH_ID): GalaxyMatch {
  return createLocalMatch(matchId, null);
}

export function advanceDemoTurn(
  match: GalaxyMatch,
  aiDifficulty: AiDifficulty | null = null,
): GalaxyMatch {
  const nextTurn = match.turn + 1;
  const friendly = match.revealedSectorOwner.filter((tile) => tile === 1).length;
  const enemy = match.revealedSectorOwner.filter((tile) => tile === 2).length;
  const profile = aiDifficulty ? getAiProfile(aiDifficulty) : null;
  let winner = NO_WINNER;
  if (profile && nextTurn >= profile.winnerTurn) {
    if (profile.preferredWinner === 1) {
      winner = enemy >= Math.max(1, friendly - 1) ? 1 : 0;
    } else {
      winner = friendly >= enemy ? 0 : 1;
    }
  } else if (!profile && nextTurn >= 8) {
    winner = 0;
  }
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
  aiDifficulty: AiDifficulty | null = null,
): GalaxyMatch {
  // Smarter AI: respond to the player's action
  if (playerOrder) {
    const profile = aiDifficulty ? getAiProfile(aiDifficulty) : null;
    const rand = seededRandom(
      match.turn * 3331 + playerOrder.targetX * 7 + playerOrder.targetY,
    );
    const map = profile
      ? applyAiTurnByDifficulty(
          [...match.revealedSectorOwner],
          profile,
          playerOrder,
          rand,
        )
      : [...match.revealedSectorOwner];

    if (!profile) {
      const targetIdx = playerOrder.targetY * MAP_SIZE + playerOrder.targetX;
      const adjacent = neighbors(targetIdx);
      const pick = adjacent[Math.floor(rand() * adjacent.length)];
      if (pick !== undefined && map[pick] === 0) {
        map[pick] = 2;
      }
    }

    // Ensure bases stay
    map[0] = 1;
    map[map.length - 1] = 2;

    return {
      ...match,
      submittedOrders: [1, 0, 0, 0],
      revealedSectorOwner: map,
    };
  }

  return {
    ...match,
    submittedOrders: [1, 0, 0, 0],
  };
}

export function applyDemoAiResponse(
  match: GalaxyMatch,
  playerOrder: { targetX: number; targetY: number; action: number },
  aiDifficulty: AiDifficulty | null = null,
): GalaxyMatch {
  const profile = aiDifficulty ? getAiProfile(aiDifficulty) : null;
  const rand = seededRandom(
    match.turn * 3331 + playerOrder.targetX * 7 + playerOrder.targetY,
  );
  const map = profile
    ? applyAiTurnByDifficulty(
        [...match.revealedSectorOwner],
        profile,
        playerOrder,
        rand,
      )
    : [...match.revealedSectorOwner];

  if (!profile) {
    const targetIdx = playerOrder.targetY * MAP_SIZE + playerOrder.targetX;
    const adjacent = neighbors(targetIdx);
    const pick = adjacent[Math.floor(rand() * adjacent.length)];
    if (pick !== undefined && map[pick] === 0) {
      map[pick] = 2;
    }
  }

  // Ensure bases stay
  map[0] = 1;
  map[map.length - 1] = 2;

  return {
    ...match,
    revealedSectorOwner: map,
  };
}

export function markDemoOpponentSubmitted(match: GalaxyMatch): GalaxyMatch {
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

const TUTORIAL_KEY = "fog-of-war-tutorial-v2-done";

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
    id: "units-and-actions",
    title: "CHOOSE THE RIGHT TOOL",
    message:
      "Use the Scout Wing when you need information, switch to Fighter Wings when a target is confirmed, and keep the Command Fleet for safe control or emergency repositioning. Move repositions, Scout gathers intel, and Attack commits force.",
    highlight: "orders",
  },
  {
    id: "submit-order",
    title: "ISSUE AN ORDER",
    message:
      "Use the order panel to choose an action - Move, Scout, or Attack - review the order, then confirm it before transmission.",
    highlight: "orders",
  },
  {
    id: "companion-mode",
    title: "USE COMPANION MODE",
    message:
      "Turn Companion Mode on when you want the assistant to suggest the best unit and action for the current board. It only advises; you still choose whether to apply and submit it.",
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
      "Scout reports reveal hidden enemy positions. Use the Enemy Signals panel to request a visibility report and update your tactical picture.",
    highlight: "visibility",
  },
];
