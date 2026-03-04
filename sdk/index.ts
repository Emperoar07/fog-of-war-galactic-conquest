// Game Client SDK — Fog of War: Galactic Conquest

export { GameClient } from "./client";

// Constants & enums
export {
  PROGRAM_ID,
  ARCIUM_PROGRAM_ID,
  DEFAULT_CLUSTER_OFFSET,
  MAX_PLAYERS,
  MAP_SIZE,
  UNITS_PER_PLAYER,
  TOTAL_UNITS,
  HIDDEN_STATE_WORDS,
  VISIBILITY_REPORT_WORDS,
  NO_WINNER,
  NO_PLAYER,
  MatchStatus,
  OrderAction,
  UnitType,
  UNIT_STATS,
  GALAXY_MATCH_SEED,
  CIRCUITS,
  SUMMARY,
} from "./constants";
export type { CircuitName } from "./constants";

// Types
export type {
  GalaxyMatch,
  BattleSummary,
  MatchReadyEvent,
  TurnResolvedEvent,
  VisibilitySnapshotReadyEvent,
  OrderParams,
  EncryptedOrder,
  MXEStatus,
  CreateMatchResult,
} from "./types";

// PDA helpers
export {
  getMatchPDA,
  getSignPDA,
  getCompDefPDA,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getClusterAccAddress,
  getFeePoolAccAddress,
  getClockAccAddress,
} from "./pda";

// Account builders
export {
  buildQueueComputationAccounts,
  buildRegisterPlayerAccounts,
} from "./accounts";

// Crypto
export {
  generatePlayerKeys,
  deriveSharedSecret,
  encryptOrder,
  checkMXEReady,
  getMXEPublicKeyWithRetry,
} from "./crypto";

// Events
export {
  onMatchReady,
  onTurnResolved,
  onVisibilityReady,
} from "./events";
