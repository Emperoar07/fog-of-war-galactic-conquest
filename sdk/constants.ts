import { PublicKey } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Program & network
// ---------------------------------------------------------------------------

export const PROGRAM_ID = new PublicKey(
  "BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE",
);

export const ARCIUM_PROGRAM_ID = new PublicKey(
  "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ",
);

export const DEFAULT_CLUSTER_OFFSET = 456;

// ---------------------------------------------------------------------------
// Game constants (mirror programs/fog_of_war_galactic_conquest/src/lib.rs)
// ---------------------------------------------------------------------------

export const MAX_PLAYERS = 4;
export const MAP_SIZE = 8;
export const UNITS_PER_PLAYER = 4;
export const TOTAL_UNITS = MAX_PLAYERS * UNITS_PER_PLAYER;
export const HIDDEN_STATE_WORDS = 5;
export const VISIBILITY_REPORT_WORDS = 2;
export const NO_WINNER = 255;
export const NO_PLAYER = 255;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum MatchStatus {
  WaitingForPlayers = 0,
  Active = 1,
  Completed = 2,
}

export enum OrderAction {
  Move = 0,
  Scout = 1,
  Attack = 2,
}

export enum UnitType {
  Command = 0,
  Scout = 1,
  Frigate = 2,
  Destroyer = 3,
}

// ---------------------------------------------------------------------------
// Unit stats (initial values from encrypted-ixs)
// ---------------------------------------------------------------------------

export const UNIT_STATS: Record<UnitType, { health: number; vision: number }> = {
  [UnitType.Command]:   { health: 5, vision: 2 },
  [UnitType.Scout]:     { health: 1, vision: 4 },
  [UnitType.Frigate]:   { health: 3, vision: 2 },
  [UnitType.Destroyer]: { health: 4, vision: 1 },
};

// ---------------------------------------------------------------------------
// PDA seeds
// ---------------------------------------------------------------------------

export const GALAXY_MATCH_SEED = "galaxy_match";
export const SIGN_PDA_SEED = "ArciumSignerAccount";
export const COMP_DEF_SEED = "ComputationDefinitionAccount";

// ---------------------------------------------------------------------------
// Circuit names
// ---------------------------------------------------------------------------

export const CIRCUITS = [
  "init_match",
  "submit_orders",
  "visibility_check",
  "resolve_turn",
] as const;

export type CircuitName = (typeof CIRCUITS)[number];

// ---------------------------------------------------------------------------
// Battle summary layout (indexes into GalaxyMatch.battleSummary[10])
// ---------------------------------------------------------------------------

export const SUMMARY = {
  WINNER: 0,
  DESTROYED_START: 1, // destroyed[0..3] at indexes 1-4
  CMD_ALIVE_START: 5, // cmdAlive[0..3] at indexes 5-8
  NEXT_TURN: 9,
} as const;
