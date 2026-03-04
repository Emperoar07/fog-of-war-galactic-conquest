import { MatchStatus, NO_WINNER } from "@sdk";

export function areOrdersReady(
  submittedOrders: readonly number[],
  playerCount: number,
): boolean {
  return submittedOrders.slice(0, playerCount).every((submitted) => submitted !== 0);
}

export function buildWinnerOverlayKey(
  matchId: bigint,
  winner: number,
  turn: number,
  status: MatchStatus,
): string | null {
  if (winner === NO_WINNER || status !== MatchStatus.Completed) {
    return null;
  }

  return `${matchId.toString()}-${winner}-${turn}`;
}
