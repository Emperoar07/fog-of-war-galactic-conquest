import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
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
import { PROGRAM_ID, CircuitName } from "./constants";

// ---------------------------------------------------------------------------
// Account sets for each instruction
// ---------------------------------------------------------------------------

export interface QueueComputationAccounts {
  payer: PublicKey;
  signPdaAccount: PublicKey;
  mxeAccount: PublicKey;
  mempoolAccount: PublicKey;
  executingPool: PublicKey;
  computationAccount: PublicKey;
  compDefAccount: PublicKey;
  clusterAccount: PublicKey;
  poolAccount: PublicKey;
  clockAccount: PublicKey;
  galaxyMatch: PublicKey;
}

/**
 * Build the full account set for any queue_computation instruction
 * (createMatch, submitOrders, visibilityCheck, resolveTurn).
 */
export function buildQueueComputationAccounts(
  payer: PublicKey,
  circuitName: CircuitName,
  computationOffset: BN,
  clusterOffset: number,
  matchPDA: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): QueueComputationAccounts {
  return {
    payer,
    signPdaAccount: getSignPDA(programId),
    mxeAccount: getMXEAccAddress(programId),
    mempoolAccount: getMempoolAccAddress(clusterOffset),
    executingPool: getExecutingPoolAccAddress(clusterOffset),
    computationAccount: getComputationAccAddress(clusterOffset, computationOffset),
    compDefAccount: getCompDefPDA(circuitName, programId),
    clusterAccount: getClusterAccAddress(clusterOffset),
    poolAccount: getFeePoolAccAddress(),
    clockAccount: getClockAccAddress(),
    galaxyMatch: matchPDA,
  };
}

export interface RegisterPlayerAccounts {
  player: PublicKey;
  galaxyMatch: PublicKey;
}

/** Build account set for registerPlayer instruction. */
export function buildRegisterPlayerAccounts(
  player: PublicKey,
  matchPDA: PublicKey,
): RegisterPlayerAccounts {
  return { player, galaxyMatch: matchPDA };
}
