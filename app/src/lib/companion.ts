import {
  MatchStatus,
  OrderAction,
  UnitType,
  type DecodedVisibilityReport,
  type GalaxyMatch,
  type OrderParams,
} from "@sdk";

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

function slotToUnitType(slot: number): UnitType {
  const localSlot = slot % 4;
  if (localSlot === 0) return UnitType.Command;
  if (localSlot === 1) return UnitType.Scout;
  return UnitType.Fighter;
}

function getUnitLabel(slot: number): string {
  const localSlot = slot % 4;
  if (localSlot === 0) return "Command Fleet";
  if (localSlot === 1) return "Scout Wing";
  return `Fighter Wing ${localSlot - 1}`;
}

function getActionLabel(action: OrderAction): string {
  switch (action) {
    case OrderAction.Move:
      return "Move";
    case OrderAction.Scout:
      return "Scout";
    case OrderAction.Attack:
      return "Attack";
    default:
      return "Act";
  }
}

function getCapabilityBonus(order: OrderParams, reasonKey: string): number {
  const unitType = slotToUnitType(order.unitSlot);

  if (order.action === OrderAction.Attack && unitType === UnitType.Fighter) return 8;
  if (order.action === OrderAction.Scout && unitType === UnitType.Scout) return 10;
  if (
    order.action === OrderAction.Move &&
    unitType === UnitType.Command &&
    reasonKey === "protect-command"
  ) {
    return 8;
  }
  if (order.action === OrderAction.Move && unitType === UnitType.Fighter) return 5;
  if (order.action === OrderAction.Move && unitType === UnitType.Command) return -6;
  if (order.action === OrderAction.Attack && unitType === UnitType.Command) return -18;
  if (order.action === OrderAction.Scout && unitType === UnitType.Command) return -10;

  return 0;
}

function buildSuggestionTitle(order: OrderParams, sectorText: string): string {
  return `Use ${getUnitLabel(order.unitSlot)}: ${getActionLabel(order.action)} ${sectorText}`;
}

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
    sectorText: string,
    reason: string,
    reasonKey: string,
    baseScore: number,
  ) => {
    const candidate: CompanionCandidate = {
      order,
      title: buildSuggestionTitle(order, sectorText),
      reason,
      reasonKey,
      memoryKey: buildMemoryKey(order, reasonKey),
      score: baseScore + getCapabilityBonus(order, reasonKey),
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
        `sector (${target.x}, ${target.y})`,
        "A fighter is the best finisher here because this is the clearest hostile contact on the board.",
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
          unitSlot: 0,
          action: OrderAction.Move,
          targetX: fallbackTile.x,
          targetY: fallbackTile.y,
        },
        `to sector (${fallbackTile.x}, ${fallbackTile.y})`,
        "Move the command fleet now because enemy pressure is close enough that preserving it matters more than expanding.",
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
        `sector (${contested.x}, ${contested.y})`,
        "The scout wing is best here because the center is contested and fresh vision is worth more than blind damage.",
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
          unitSlot: 3,
          action: OrderAction.Move,
          targetX: neutral.x,
          targetY: neutral.y,
        },
        `to sector (${neutral.x}, ${neutral.y})`,
        "A fighter should take this lane so you gain board control without exposing the command fleet.",
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
      `sector (${selectedCell.x}, ${selectedCell.y})`,
      "The scout wing is the safest way to test your selected lane before you commit a fighter to it.",
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
      "sector (0, 0)",
      "No strong target is visible, so a scout is the best default because it keeps initiative without overcommitting.",
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
