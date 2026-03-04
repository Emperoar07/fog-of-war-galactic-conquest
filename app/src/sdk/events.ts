import { Program } from "@coral-xyz/anchor";
import type {
  MatchReadyEvent,
  TurnResolvedEvent,
  VisibilitySnapshotReadyEvent,
} from "./types";

type ProgramEventCallback = (...args: unknown[]) => void;
type EventCapableProgram = Program & {
  addEventListener(eventName: string, callback: ProgramEventCallback): number;
};

function asEventProgram(program: Program): EventCapableProgram {
  return program as unknown as EventCapableProgram;
}

// ---------------------------------------------------------------------------
// Typed event subscriptions
// ---------------------------------------------------------------------------

export function onMatchReady(
  program: Program,
  callback: (event: MatchReadyEvent) => void,
): number {
  return asEventProgram(program).addEventListener(
    "matchReady",
    callback as unknown as ProgramEventCallback,
  );
}

export function onTurnResolved(
  program: Program,
  callback: (event: TurnResolvedEvent) => void,
): number {
  return asEventProgram(program).addEventListener(
    "turnResolved",
    callback as unknown as ProgramEventCallback,
  );
}

export function onVisibilityReady(
  program: Program,
  callback: (event: VisibilitySnapshotReadyEvent) => void,
): number {
  return asEventProgram(program).addEventListener(
    "visibilitySnapshotReady",
    callback as unknown as ProgramEventCallback,
  );
}

export function removeListener(program: Program, id: number): Promise<void> {
  return program.removeEventListener(id);
}
