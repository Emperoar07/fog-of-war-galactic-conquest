import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { MatchStatus, OrderAction } from "./constants";

// ---------------------------------------------------------------------------
// On-chain account state
// ---------------------------------------------------------------------------

export interface GalaxyMatch {
  matchId: BN;
  authority: PublicKey;
  players: PublicKey[];
  playerCount: number;
  turn: number;
  status: MatchStatus;
  mapSeed: BN;
  revealedSectorOwner: number[];
  battleSummary: number[];
  submittedOrders: number[];
  hiddenState: number[][];
  hiddenStateNonce: BN;
  lastVisibility: number[][];
  lastVisibilityNonce: BN;
  lastVisibilityViewer: number;
}

// ---------------------------------------------------------------------------
// Parsed battle summary
// ---------------------------------------------------------------------------

export interface BattleSummary {
  winner: number;
  destroyedByPlayer: number[];
  commandFleetAlive: boolean[];
  nextTurn: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface MatchReadyEvent {
  matchId: BN;
  playerCount: number;
}

export interface TurnResolvedEvent {
  matchId: BN;
  winner: number;
  nextTurn: number;
}

export interface VisibilitySnapshotReadyEvent {
  matchId: BN;
  turn: number;
  viewerIndex: number;
}

// ---------------------------------------------------------------------------
// Order params (user-facing, pre-encryption)
// ---------------------------------------------------------------------------

export interface OrderParams {
  unitSlot: number;
  action: OrderAction;
  targetX: number;
  targetY: number;
}

// ---------------------------------------------------------------------------
// Encrypted order (ready to submit on-chain)
// ---------------------------------------------------------------------------

export interface EncryptedOrder {
  unitSlotCt: number[];
  actionCt: number[];
  targetXCt: number[];
  targetYCt: number[];
  publicKey: number[];
  nonceBN: BN;
}

// ---------------------------------------------------------------------------
// MXE status
// ---------------------------------------------------------------------------

export interface MXEStatus {
  ready: boolean;
  x25519PubKey: Uint8Array | null;
}

// ---------------------------------------------------------------------------
// Match creation result
// ---------------------------------------------------------------------------

export interface CreateMatchResult {
  txSig: string;
  matchPDA: PublicKey;
  matchId: bigint;
}
