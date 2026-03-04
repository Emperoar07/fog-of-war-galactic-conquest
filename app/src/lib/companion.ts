import { MatchStatus, OrderAction, type DecodedVisibilityReport, type GalaxyMatch, type OrderParams } from "@sdk";

export type CompanionSuggestion = {
  order: OrderParams;
  title: string;
  reason: string;
  reasonKey: string;
  memoryKey: string;
};

export type CompanionHistoryEntry = {
  unitSlot: number;
  action: OrderAction;
  targetX: number;
  targetY: number;
  reasonKey: string;
  memoryKey: string;
};

type CompanionCandidate = CompanionSuggestion & {
  score: number;
};

function buildMemoryKey(order: OrderParams, reasonKey: string): string {
  return `${order.unitSlot}-${order.action}-${order.targetX}-${order.targetY}-${reasonKey}`;
}

function applyRepeatPenalty(
  candidate: CompanionCandidate,
  history: CompanionHistoryEntry[],
): number {
  let score = candidate.score;

  for (const entry of history) {
    if (entry.action === candidate.order.action) score -= 5;
    if (entry.unitSlot === candidate.order.unitSlot) score -= 3;
    if (
      entry.targetX === candidate.order.targetX &&
      entry.targetY === candidate.order.targetY
    ) {
      score -= 10;
    }
    if (entry.reasonKey === candidate.reasonKey) score -= 7;
    if (entry.memoryKey === candidate.memoryKey) score -= 14;
  }

  return score;
}

export function createCompanionHistoryEntry(
  order: OrderParams,
  source?: Pick<CompanionSuggestion, "reasonKey" | "memoryKey"> | null,
): CompanionHistoryEntry {
  const reasonKey = source?.reasonKey ?? "manual-order";
  return {
    unitSlot: order.unitSlot,
    action: order.action,
    targetX: order.targetX,
    targetY: order.targetY,
    reasonKey,
    memoryKey: source?.memoryKey ?? buildMemoryKey(order, reasonKey),
  };
}

export function buildCompanionSuggestion(args: {
  enabled: boolean;
  match: GalaxyMatch | null;
  playerSlot: number | null;
  selectedCell: { x: number; y: number } | null;
  visibilityReport: DecodedVisibilityReport | null;
  history: CompanionHistoryEntry[];
}): CompanionSuggestion | null {
  const { enabled, match, playerSlot, selectedCell, visibilityReport, history } = args;

  if (!enabled || !match || playerSlot === null || match.status !== MatchStatus.Active) {
    return null;
  }

  const size = Math.sqrt(match.revealedSectorOwner.length) || 1;
  const center = (size - 1) / 2;
  const tiles = match.revealedSectorOwner.map((owner, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const score = Math.abs(x - center) + Math.abs(y - center);
    return { owner, x, y, score };
  });

  const candidates: CompanionCandidate[] = [];

  const addCandidate = (
    order: OrderParams,
    title: string,
    reason: string,
    reasonKey: string,
    baseScore: number,
  ) => {
    const candidate: CompanionCandidate = {
      order,
      title,
      reason,
      reasonKey,
      memoryKey: buildMemoryKey(order, reasonKey),
      score: baseScore,
    };
    candidate.score = applyRepeatPenalty(candidate, history);
    candidates.push(candidate);
  };

  const threatNearCommand = tiles.some(
    (tile) =>
      (tile.owner === 2 || tile.owner === 3 || tile.owner === 4) &&
      tile.x <= 2 &&
      tile.y <= 2,
  );

  if (visibilityReport && visibilityReport.units.length > 0) {
    for (const target of visibilityReport.units.slice(0, 2)) {
      const distanceFromCenter =
        Math.abs(target.x - center) + Math.abs(target.y - center);
      addCandidate(
        {
          unitSlot: 2,
          action: OrderAction.Attack,
          targetX: target.x,
          targetY: target.y,
        },
        `Attack sector (${target.x}, ${target.y})`,
        "Attack the clearest hostile contact before it can reposition.",
        "attack-visible",
        96 - distanceFromCenter * 3,
      );
    }
  }

  if (threatNearCommand) {
    const fallbackTile =
      tiles
        .filter((tile) => tile.owner === 1)
        .sort((a, b) => a.score - b.score)[0] ?? { x: 1, y: 1, score: 0 };
    addCandidate(
      {
        unitSlot: 2,
        action: OrderAction.Move,
        targetX: fallbackTile.x,
        targetY: fallbackTile.y,
      },
      `Reposition command to (${fallbackTile.x}, ${fallbackTile.y})`,
      "Enemy pressure is near your base, so preserving the command fleet takes priority.",
      "protect-command",
      82,
    );
  }

  for (const contested of tiles
    .filter((tile) => tile.owner === 3)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)) {
    addCandidate(
      {
        unitSlot: 1,
        action: OrderAction.Scout,
        targetX: contested.x,
        targetY: contested.y,
      },
      `Scout sector (${contested.x}, ${contested.y})`,
      "Scout the contested center to expand vision before committing heavier units.",
      "scout-contested",
      76 - contested.score * 4,
    );
  }

  for (const neutral of tiles
    .filter((tile) => tile.owner === 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)) {
    addCandidate(
      {
        unitSlot: 0,
        action: OrderAction.Move,
        targetX: neutral.x,
        targetY: neutral.y,
      },
      `Advance to sector (${neutral.x}, ${neutral.y})`,
      "Advance into open space to improve board control without overextending.",
      "expand-neutral",
      62 - neutral.score * 3,
    );
  }

  if (selectedCell) {
    addCandidate(
      {
        unitSlot: 1,
        action: OrderAction.Scout,
        targetX: selectedCell.x,
        targetY: selectedCell.y,
      },
      `Probe sector (${selectedCell.x}, ${selectedCell.y})`,
      "Your selected sector is a good probe point if you want to test this lane next.",
      "probe-selected",
      58,
    );
  }

  if (candidates.length === 0) {
    addCandidate(
      {
        unitSlot: 1,
        action: OrderAction.Scout,
        targetX: 0,
        targetY: 0,
      },
      "Scout sector (0, 0)",
      "No strong signal is visible, so a cautious scout keeps the initiative without overcommitting.",
      "fallback-scout",
      48,
    );
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return best
    ? {
        order: best.order,
        title: best.title,
        reason: best.reason,
        reasonKey: best.reasonKey,
        memoryKey: best.memoryKey,
      }
    : null;
}
