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
  aggression: number;
  captureChance: number;
  contestResolveChance: number;
  moveBudgetMin: number;
  moveBudgetMax: number;
  waveCount: number;
  playerCaptureRadius: number;
  playerCaptureCount: number;
  counterAttackBonus: number;
  flankingBonus: number;
  cutOffBonus: number;
  minTurnsToWin: number;
};

const AI_PROFILES: Record<AiDifficulty, AiProfile> = {
  easy: {
    label: "Easy",
    lockDelayMs: 1400,
    aggression: 0.25,
    captureChance: 0.15,
    contestResolveChance: 0.3,
    moveBudgetMin: 1,
    moveBudgetMax: 3,
    waveCount: 1,
    playerCaptureRadius: 2,
    playerCaptureCount: 2,
    counterAttackBonus: 0,
    flankingBonus: 0,
    cutOffBonus: 0,
    minTurnsToWin: 10,
  },
  medium: {
    label: "Medium",
    lockDelayMs: 900,
    aggression: 0.55,
    captureChance: 0.5,
    contestResolveChance: 0.6,
    moveBudgetMin: 3,
    moveBudgetMax: 6,
    waveCount: 2,
    playerCaptureRadius: 2,
    playerCaptureCount: 2,
    counterAttackBonus: 1.5,
    flankingBonus: 1.0,
    cutOffBonus: 0.5,
    minTurnsToWin: 8,
  },
  hard: {
    label: "Hard",
    lockDelayMs: 500,
    aggression: 0.85,
    captureChance: 0.85,
    contestResolveChance: 0.9,
    moveBudgetMin: 5,
    moveBudgetMax: 10,
    waveCount: 3,
    playerCaptureRadius: 3,
    playerCaptureCount: 3,
    counterAttackBonus: 3.0,
    flankingBonus: 2.5,
    cutOffBonus: 2.0,
    minTurnsToWin: 6,
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
// Board analysis
// ---------------------------------------------------------------------------

interface BoardAnalysis {
  aiTiles: number[];
  playerTiles: number[];
  contested: number[];
  neutral: number[];
  aiFrontier: Set<number>;    // non-AI tiles adjacent to AI territory
  playerFrontier: Set<number>;// non-player tiles adjacent to player territory
  aiConnected: Set<number>;   // all AI tiles reachable from AI base
  playerConnected: Set<number>;
}

function analyzeBoard(map: number[]): BoardAnalysis {
  const aiTiles: number[] = [];
  const playerTiles: number[] = [];
  const contested: number[] = [];
  const neutral: number[] = [];
  const aiFrontier = new Set<number>();
  const playerFrontier = new Set<number>();

  for (let i = 0; i < map.length; i++) {
    switch (map[i]) {
      case 1: playerTiles.push(i); break;
      case 2: aiTiles.push(i); break;
      case 3: contested.push(i); break;
      case 0: neutral.push(i); break;
    }
  }

  for (const idx of aiTiles) {
    for (const n of neighbors(idx)) {
      if (map[n] !== 2 && map[n] !== 4) aiFrontier.add(n);
    }
  }
  for (const idx of playerTiles) {
    for (const n of neighbors(idx)) {
      if (map[n] !== 1 && map[n] !== 4) playerFrontier.add(n);
    }
  }

  // Flood fill connectivity from bases
  const aiConnected = floodFill(map, map.length - 1, 2);
  const playerConnected = floodFill(map, 0, 1);

  return { aiTiles, playerTiles, contested, neutral, aiFrontier, playerFrontier, aiConnected, playerConnected };
}

function floodFill(map: number[], start: number, owner: number): Set<number> {
  const visited = new Set<number>();
  if (map[start] !== owner) return visited;
  const stack = [start];
  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited.has(idx)) continue;
    if (map[idx] !== owner) continue;
    visited.add(idx);
    for (const n of neighbors(idx)) stack.push(n);
  }
  return visited;
}

function gridDistance(a: number, b: number): number {
  const pa = fromIndex(a);
  const pb = fromIndex(b);
  return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
}

// ---------------------------------------------------------------------------
// Player action application — the player's order actually changes the board
// ---------------------------------------------------------------------------

function applyPlayerAction(
  map: number[],
  order: { targetX: number; targetY: number; action: number },
  rand: () => number,
): number[] {
  const next = [...map];
  const target = toIndex(order.targetX, order.targetY);

  if (order.action === 2) {
    // ATTACK: capture the target tile (even enemy) + up to 2 adjacent tiles
    if (next[target] !== 4) next[target] = 1;
    // Capture up to 2 adjacent non-player tiles (prioritize enemy over neutral)
    const adjAll = neighbors(target).filter((n) => next[n] !== 1 && next[n] !== 4);
    const adjEnemy = adjAll.filter((n) => next[n] === 2);
    const adjOther = adjAll.filter((n) => next[n] !== 2);
    const sorted = [...adjEnemy, ...adjOther];
    const captureCount = Math.min(2, sorted.length);
    for (let i = 0; i < captureCount; i++) {
      const pick = i < sorted.length ? sorted[i] : sorted[Math.floor(rand() * sorted.length)];
      next[pick] = 1;
    }
  } else if (order.action === 1) {
    // SCOUT: contest the target + reveal (contest nearby enemy tiles)
    if (next[target] === 2) next[target] = 3;
    else if (next[target] === 0) next[target] = 1;
    for (const n of neighbors(target)) {
      if (next[n] === 2 && rand() < 0.4) next[n] = 3;
    }
  } else {
    // MOVE: claim the target if neutral/contested, + 1 adjacent neutral
    if (next[target] === 0 || next[target] === 3) next[target] = 1;
    const adjNeutral = neighbors(target).filter((n) => next[n] === 0);
    if (adjNeutral.length > 0) {
      next[adjNeutral[Math.floor(rand() * adjNeutral.length)]] = 1;
    }
  }

  // Ensure player base stays
  next[0] = 1;
  return next;
}

// ---------------------------------------------------------------------------
// AI move generation with strategic scoring
// ---------------------------------------------------------------------------

interface AiMove {
  index: number;
  newOwner: number;
  score: number;
  _gated?: "capture" | "contest";
}

function generateMoves(
  map: number[],
  analysis: BoardAnalysis,
  profile: AiProfile,
  playerTarget: number,
  playerAction: number,
): AiMove[] {
  const moves: AiMove[] = [];
  const totalTiles = MAP_SIZE * MAP_SIZE;
  const center = (MAP_SIZE - 1) / 2;

  for (const idx of analysis.aiFrontier) {
    const tile = map[idx];
    if (tile === 4) continue;

    const adj = neighbors(idx);
    const aiAdj = adj.filter((n) => map[n] === 2).length;
    const { x, y } = fromIndex(idx);
    const centerDist = Math.abs(x - center) + Math.abs(y - center);

    if (tile === 0) {
      // Expand into neutral
      let score = 1.0 + aiAdj * 0.5;
      // Block player expansion — high priority
      if (analysis.playerFrontier.has(idx)) score += 2.0 + profile.aggression;
      // Center control
      score += Math.max(0, 3 - centerDist * 0.4);
      moves.push({ index: idx, newOwner: 2, score });
    }

    if (tile === 1) {
      // Capture enemy territory
      let score = 2.5 + profile.aggression * 3.0;
      score += aiAdj * 1.0;
      // FLANKING: if player tile is only connected from one side, bonus
      const playerSupportAdj = adj.filter((n) => map[n] === 1).length;
      if (playerSupportAdj <= 1) score += profile.flankingBonus;
      // CUT OFF: if capturing disconnects player tiles from their base
      if (!analysis.playerConnected.has(idx)) score += profile.cutOffBonus;
      // Counter-attack near player's target
      const distToTarget = gridDistance(idx, playerTarget);
      if (playerAction === 2 && distToTarget <= 2) score += profile.counterAttackBonus;
      // Mark as needing probability gate (applied in applyAiTurn with real rand)
      moves.push({ index: idx, newOwner: 2, score, _gated: "capture" as const });
    }

    if (tile === 3) {
      // Resolve contested tile
      let score = 2.0 + profile.aggression * 2.0;
      score += aiAdj * 0.6;
      moves.push({ index: idx, newOwner: 2, score, _gated: "contest" as const });
    }
  }

  // Recapture tiles near AI base that were lost
  const aiBase = totalTiles - 1;
  for (const n of neighbors(aiBase)) {
    if (map[n] === 1 || map[n] === 3) {
      moves.push({ index: n, newOwner: 2, score: 8.0 + profile.aggression * 2.0 });
    }
    for (const nn of neighbors(n)) {
      if (nn !== aiBase && (map[nn] === 1 || map[nn] === 3) && !moves.some(m => m.index === nn)) {
        moves.push({ index: nn, newOwner: 2, score: 5.0 + profile.aggression });
      }
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// AI turn execution — multi-wave with re-analysis
// ---------------------------------------------------------------------------

function applyAiTurn(
  map: number[],
  profile: AiProfile,
  playerOrder: { targetX: number; targetY: number; action: number },
  rand: () => number,
): number[] {
  const next = [...map];
  const used = new Set<number>();
  const playerTarget = toIndex(playerOrder.targetX, playerOrder.targetY);

  const budget = profile.moveBudgetMin +
    Math.floor(rand() * (profile.moveBudgetMax - profile.moveBudgetMin + 1));
  let remaining = budget;

  for (let wave = 0; wave < profile.waveCount && remaining > 0; wave++) {
    const analysis = analyzeBoard(next);
    const allMoves = generateMoves(next, analysis, profile, playerTarget, playerOrder.action);
    if (allMoves.length === 0) break;

    // Apply probability gating with real randomness
    for (const m of allMoves) {
      if (m._gated === "capture" && rand() >= profile.captureChance) {
        m.score *= 0.1; // Failed capture roll — deprioritize
      }
      if (m._gated === "contest" && rand() >= profile.contestResolveChance) {
        m.score *= 0.1;
      }
    }

    allMoves.sort((a, b) => b.score - a.score);

    // Easy: shuffle to make moves suboptimal
    if (profile.label === "Easy") {
      for (let i = allMoves.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [allMoves[i], allMoves[j]] = [allMoves[j], allMoves[i]];
      }
    }
    // Medium: partial shuffle of top candidates
    else if (profile.label === "Medium") {
      const top = Math.max(3, Math.ceil(allMoves.length * 0.65));
      const pool = allMoves.slice(0, top);
      for (let i = pool.length - 1; i > 1; i--) {
        if (rand() < 0.3) {
          const j = Math.floor(rand() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }
      allMoves.splice(0, top, ...pool);
    }
    // Hard: optimal ordering, no shuffle

    const perWave = Math.max(1, Math.ceil(budget / profile.waveCount));
    let applied = 0;
    for (const m of allMoves) {
      if (applied >= perWave || remaining <= 0) break;
      if (used.has(m.index)) continue;
      if (m.score < 0.5) continue; // skip terrible moves
      next[m.index] = m.newOwner;
      used.add(m.index);
      applied++;
      remaining--;
    }
  }

  // Hard mode bonus: also contest player tiles that are isolated (not connected to player base)
  if (profile.label === "Hard" && remaining > 0) {
    const postAnalysis = analyzeBoard(next);
    for (const idx of postAnalysis.playerTiles) {
      if (remaining <= 0) break;
      if (used.has(idx)) continue;
      if (!postAnalysis.playerConnected.has(idx)) {
        next[idx] = 2;
        used.add(idx);
        remaining--;
      }
    }
  }

  // Ensure AI base stays
  next[next.length - 1] = 2;
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

export function summarizeAiMoves(before: number[], after: number[]): string {
  let captured = 0;
  let contested = 0;
  let expanded = 0;
  let lost = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] === after[i]) continue;
    if (after[i] === 2 && before[i] === 1) captured++;
    else if (after[i] === 2 && before[i] === 3) contested++;
    else if (after[i] === 2 && before[i] === 0) expanded++;
    else if (before[i] === 2 && after[i] !== 2) lost++;
  }
  const parts: string[] = [];
  if (captured > 0) parts.push(`captured ${captured} of your tiles`);
  if (contested > 0) parts.push(`resolved ${contested} contested`);
  if (expanded > 0) parts.push(`expanded into ${expanded} neutral`);
  if (lost > 0) parts.push(`lost ${lost} tiles`);
  if (parts.length === 0) return "AI held position — no territory changed.";
  return `AI ${parts.join(", ")}.`;
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
  const mid = Math.floor(MAP_SIZE / 2);

  // Player 1 fills top-left quadrant
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dist = x + y;
      if (dist <= mid) tiles[y * MAP_SIZE + x] = 1;
    }
  }
  // Player 2 fills bottom-right quadrant
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dist = (MAP_SIZE - 1 - x) + (MAP_SIZE - 1 - y);
      if (dist <= mid) tiles[y * MAP_SIZE + x] = 2;
    }
  }

  // Middle band becomes contested or neutral
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const idx = y * MAP_SIZE + x;
      const distP1 = x + y;
      const distP2 = (MAP_SIZE - 1 - x) + (MAP_SIZE - 1 - y);
      // Tiles equidistant from both bases: contested or neutral
      if (distP1 === distP2) {
        tiles[idx] = rand() < 0.5 ? 3 : 0;
      } else if (Math.abs(distP1 - distP2) <= 1) {
        // Near the border: some become contested
        if (rand() < 0.35) tiles[idx] = 3;
      }
    }
  }

  // Additional expansion passes based on turn
  for (let pass = 0; pass < turn; pass++) {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] !== 0) continue;
      const x = i % MAP_SIZE;
      const y = Math.floor(i / MAP_SIZE);
      const adj = [
        y > 0 ? tiles[i - MAP_SIZE] : 0,
        y < MAP_SIZE - 1 ? tiles[i + MAP_SIZE] : 0,
        x > 0 ? tiles[i - 1] : 0,
        x < MAP_SIZE - 1 ? tiles[i + 1] : 0,
      ];
      const p1Adjacent = adj.filter((n) => n === 1).length;
      const p2Adjacent = adj.filter((n) => n === 2).length;
      if (p1Adjacent > 0 && rand() < 0.3 + p1Adjacent * 0.15) tiles[i] = 1;
      else if (p2Adjacent > 0 && rand() < 0.3 + p2Adjacent * 0.15) tiles[i] = 2;
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
    lastTurnStart: new BN(Math.floor(Date.now() / 1000)),
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
  // PRESERVE the current board — do NOT regenerate from scratch
  const map = [...match.revealedSectorOwner];

  // Natural decay: contested tiles (3) randomly resolve or go neutral
  const rand = seededRandom(nextTurn * 7919 + 31);
  for (let i = 0; i < map.length; i++) {
    if (map[i] === 3) {
      const r = rand();
      const aiAdj = neighbors(i).filter((n) => map[n] === 2).length;
      const plAdj = neighbors(i).filter((n) => map[n] === 1).length;
      if (aiAdj > plAdj && r < 0.4) map[i] = 2;
      else if (plAdj > aiAdj && r < 0.4) map[i] = 1;
      else if (r < 0.15) map[i] = 0;
    }
  }

  // Ensure bases stay
  map[0] = 1;
  map[map.length - 1] = 2;

  const friendly = map.filter((t) => t === 1).length;
  const enemy = map.filter((t) => t === 2).length;
  const total = MAP_SIZE * MAP_SIZE;
  const profile = aiDifficulty ? getAiProfile(aiDifficulty) : null;
  const minTurns = profile ? profile.minTurnsToWin : 8;

  // Winner determined by ACTUAL territory control
  let winner = NO_WINNER;
  if (nextTurn >= minTurns) {
    const majorityThreshold = Math.floor(total * 0.55);
    if (enemy >= majorityThreshold) winner = 1;      // AI wins
    else if (friendly >= majorityThreshold) winner = 0; // Player wins
  }
  // Also end if one side is nearly eliminated
  if (friendly <= 2 && nextTurn >= 4) winner = 1;
  if (enemy <= 2 && nextTurn >= 4) winner = 0;

  return {
    ...match,
    turn: nextTurn,
    status: winner === NO_WINNER ? MatchStatus.Active : MatchStatus.Completed,
    battleSummary: makeBattleSummary(nextTurn, winner),
    submittedOrders: [0, 0, 0, 0],
    revealedSectorOwner: map,
  };
}

export function markDemoOrdersSubmitted(
  match: GalaxyMatch,
  playerOrder?: { targetX: number; targetY: number; action: number },
  aiDifficulty: AiDifficulty | null = null,
): GalaxyMatch {
  if (!playerOrder) {
    return { ...match, submittedOrders: [1, 0, 0, 0] };
  }

  // 1) Apply PLAYER's action to the board first
  const difficultySalt =
    aiDifficulty === "hard" ? 73 : aiDifficulty === "medium" ? 37 : 0;
  const rand = seededRandom(
    match.turn * 3331 + playerOrder.targetX * 7 + playerOrder.targetY + difficultySalt,
  );
  const mapAfterPlayer = applyPlayerAction(
    [...match.revealedSectorOwner],
    playerOrder,
    rand,
  );

  return {
    ...match,
    submittedOrders: [1, 0, 0, 0],
    revealedSectorOwner: mapAfterPlayer,
  };
}

export function applyDemoAiResponse(
  match: GalaxyMatch,
  playerOrder: { targetX: number; targetY: number; action: number },
  aiDifficulty: AiDifficulty | null = null,
): GalaxyMatch {
  const profile = aiDifficulty ? getAiProfile(aiDifficulty) : null;
  const rand = seededRandom(
    match.turn * 3331 + playerOrder.targetX * 7 + playerOrder.targetY + 997,
  );

  let map: number[];
  if (profile) {
    // 2) AI responds to the board (which already has player's action applied)
    map = applyAiTurn([...match.revealedSectorOwner], profile, playerOrder, rand);
  } else {
    // Demo fallback: AI grabs one adjacent neutral tile
    map = [...match.revealedSectorOwner];
    const targetIdx = toIndex(playerOrder.targetX, playerOrder.targetY);
    const adjacent = neighbors(targetIdx);
    const pick = adjacent[Math.floor(rand() * adjacent.length)];
    if (pick !== undefined && map[pick] === 0) map[pick] = 2;
  }

  map[0] = 1;
  map[map.length - 1] = 2;

  return { ...match, revealedSectorOwner: map };
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
