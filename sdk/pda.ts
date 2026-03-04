import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getClusterAccAddress,
  getFeePoolAccAddress,
  getClockAccAddress,
  getArciumAccountBaseSeed,
  getCompDefAccOffset,
  getArciumProgramId,
} from "@arcium-hq/client";
import {
  PROGRAM_ID,
  GALAXY_MATCH_SEED,
  SIGN_PDA_SEED,
  CircuitName,
} from "./constants";

// ---------------------------------------------------------------------------
// Game PDAs
// ---------------------------------------------------------------------------

function encodeU64LE(value: bigint): Buffer {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, value, true);
  return Buffer.from(bytes);
}

/** Derive the GalaxyMatch PDA from a match ID. */
export function getMatchPDA(
  matchId: bigint | BN,
  programId: PublicKey = PROGRAM_ID,
): [PublicKey, number] {
  const buf = encodeU64LE(
    typeof matchId === "bigint" ? matchId : BigInt(matchId.toString()),
  );
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GALAXY_MATCH_SEED), buf],
    programId,
  );
}

/** Derive the ArciumSignerAccount PDA for our program. */
export function getSignPDA(programId: PublicKey = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SIGN_PDA_SEED)],
    programId,
  )[0];
}

// ---------------------------------------------------------------------------
// Arcium PDAs
// ---------------------------------------------------------------------------

/**
 * Derive the ComputationDefinitionAccount PDA for a circuit.
 *
 * IMPORTANT: Do NOT use getCompDefAccAddress() with getCompDefAccOffset() —
 * getCompDefAccAddress expects a number, but getCompDefAccOffset returns a
 * Uint8Array. Use this function instead.
 */
export function getCompDefPDA(
  circuitName: CircuitName,
  programId: PublicKey = PROGRAM_ID,
): PublicKey {
  const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  const offset = getCompDefAccOffset(circuitName);
  return PublicKey.findProgramAddressSync(
    [baseSeed, programId.toBuffer(), offset],
    getArciumProgramId(),
  )[0];
}

// Re-export Arcium PDA helpers for convenience
export {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getClusterAccAddress,
  getFeePoolAccAddress,
  getClockAccAddress,
};
