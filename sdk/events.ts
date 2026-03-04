import { Program } from "@coral-xyz/anchor";
import type {
  MatchReadyEvent,
  TurnResolvedEvent,
  VisibilitySnapshotReadyEvent,
} from "./types";

// ---------------------------------------------------------------------------
// Typed event subscriptions
// ---------------------------------------------------------------------------

export function onMatchReady(
  program: Program,
  callback: (event: MatchReadyEvent) => void,
): number {
  return program.addEventListener("matchReady" as any, callback as any);
}

export function onTurnResolved(
  program: Program,
  callback: (event: TurnResolvedEvent) => void,
): number {
  return program.addEventListener("turnResolved" as any, callback as any);
}

export function onVisibilityReady(
  program: Program,
  callback: (event: VisibilitySnapshotReadyEvent) => void,
): number {
  return program.addEventListener(
    "visibilitySnapshotReady" as any,
    callback as any,
  );
}

export function removeListener(program: Program, id: number): Promise<void> {
  return program.removeEventListener(id);
}
