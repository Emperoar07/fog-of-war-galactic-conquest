import { BN } from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  x25519,
  RescueCipher,
  deserializeLE,
  serializeLE,
  getMXEPublicKey,
} from "@arcium-hq/client";
import { PROGRAM_ID } from "./constants";
import type {
  OrderParams,
  EncryptedOrder,
  MXEStatus,
  DecodedVisibilityReport,
} from "./types";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

const TOTAL_UNITS = 16;
const VISIBILITY_PRESENT_OFFSET = 0;
const VISIBILITY_X_OFFSET = VISIBILITY_PRESENT_OFFSET + TOTAL_UNITS;
const VISIBILITY_Y_OFFSET = VISIBILITY_X_OFFSET + TOTAL_UNITS;
const EMPTY_COORD = 255;

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/** Generate a fresh x25519 keypair for encrypted order submission. */
export function generatePlayerKeys(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/** Derive x25519 shared secret from player private key and MXE public key. */
export function deriveSharedSecret(
  privateKey: Uint8Array,
  mxePublicKey: Uint8Array,
): Uint8Array {
  if (privateKey.length !== 32 || privateKey.every((b) => b === 0)) {
    throw new Error("Invalid private key: must be 32 non-zero bytes");
  }
  if (mxePublicKey.length !== 32 || mxePublicKey.every((b) => b === 0)) {
    throw new Error("Invalid MXE public key: must be 32 non-zero bytes");
  }
  return x25519.getSharedSecret(privateKey, new Uint8Array(mxePublicKey));
}

// ---------------------------------------------------------------------------
// Order encryption
// ---------------------------------------------------------------------------

/**
 * Encrypt an order's fields individually using RescueCipher.
 * Returns the four ciphertexts, the player's public key, and nonce as BN.
 */
export function encryptOrder(
  order: OrderParams,
  privateKey: Uint8Array,
  mxePublicKey: Uint8Array,
): EncryptedOrder {
  const sharedSecret = deriveSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const nonce = randomBytes(16);
  const publicKey = x25519.getPublicKey(privateKey);

  const unitSlotCt = cipher.encrypt([BigInt(order.unitSlot)], nonce);
  const actionCt = cipher.encrypt([BigInt(order.action)], nonce);
  const targetXCt = cipher.encrypt([BigInt(order.targetX)], nonce);
  const targetYCt = cipher.encrypt([BigInt(order.targetY)], nonce);

  return {
    unitSlotCt: Array.from(unitSlotCt[0]),
    actionCt: Array.from(actionCt[0]),
    targetXCt: Array.from(targetXCt[0]),
    targetYCt: Array.from(targetYCt[0]),
    publicKey: Array.from(publicKey),
    nonceBN: new BN(deserializeLE(nonce).toString()),
  };
}

/**
 * Decrypt a 48-byte visibility report returned by the program and parse visible enemy units.
 * Legacy function: used with MXE-encrypted visibility
 */
export function decryptVisibilityReport(
  ciphertext: number[][],
  nonceBN: BN,
  privateKey: Uint8Array,
  mxePublicKey: Uint8Array,
): DecodedVisibilityReport {
  const sharedSecret = deriveSharedSecret(privateKey, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const nonce = serializeLE(BigInt(nonceBN.toString()), 16);
  const plaintext = cipher.decrypt(ciphertext, nonce);
  const bytes = plaintext.map((value) => Number(value));

  if (bytes.length < VISIBILITY_Y_OFFSET + TOTAL_UNITS) {
    throw new Error("Visibility report is shorter than expected.");
  }

  const visibleSlots: number[] = [];
  const units: DecodedVisibilityReport["units"] = [];

  for (let slot = 0; slot < TOTAL_UNITS; slot++) {
    if (bytes[VISIBILITY_PRESENT_OFFSET + slot] !== 1) continue;
    const x = bytes[VISIBILITY_X_OFFSET + slot];
    const y = bytes[VISIBILITY_Y_OFFSET + slot];
    visibleSlots.push(slot);
    if (x !== EMPTY_COORD && y !== EMPTY_COORD) {
      units.push({ slot, x, y });
    }
  }

  return { visibleSlots, units };
}

/**
 * Sprint 5b: Decrypt per-player encrypted visibility reports
 * Each player's visibility is encrypted to their own x25519 keypair
 * Only the intended player can decrypt their visibility using their private key
 * 
 * @param ciphertext - The encrypted visibility report (48 bytes from circuit)
 * @param nonceBN - The nonce used for encryption
 * @param playerPrivateKey - The player's x25519 private key
 * @param mxePublicKey - The MXE cluster's x25519 public key
 * @returns Decoded visibility report with visible enemy unit slots and coordinates
 */
export function decryptPlayerVisibility(
  ciphertext: number[][],
  nonceBN: BN,
  playerPrivateKey: Uint8Array,
  mxePublicKey: Uint8Array,
): DecodedVisibilityReport {
  // Use same decryption as MXE-encrypted reports
  // The difference is that the ciphertext was encrypted with the player's pubkey
  // instead of the shared secret
  return decryptVisibilityReport(ciphertext, nonceBN, playerPrivateKey, mxePublicKey);
}

/**
 * Sprint 5b: Parse raw visibility data from circuit event
 * When visibility is emitted as an event, it includes the raw bytes array
 * This helper extracts visible unit information from the raw data
 * 
 * @param visibilityBytes - Raw 48-byte visibility data from circuit
 * @returns Parsed visibility with visible slots and unit coordinates
 */
export function parseVisibilityBytes(visibilityBytes: Uint8Array): DecodedVisibilityReport {
  if (visibilityBytes.length < VISIBILITY_Y_OFFSET + TOTAL_UNITS) {
    throw new Error("Visibility data is shorter than expected.");
  }

  const visibleSlots: number[] = [];
  const units: DecodedVisibilityReport["units"] = [];

  for (let slot = 0; slot < TOTAL_UNITS; slot++) {
    if (visibilityBytes[VISIBILITY_PRESENT_OFFSET + slot] !== 1) continue;
    const x = visibilityBytes[VISIBILITY_X_OFFSET + slot];
    const y = visibilityBytes[VISIBILITY_Y_OFFSET + slot];
    visibleSlots.push(slot);
    if (x !== EMPTY_COORD && y !== EMPTY_COORD) {
      units.push({ slot, x, y });
    }
  }

  return { visibleSlots, units };
}

// ---------------------------------------------------------------------------
// MXE readiness
// ---------------------------------------------------------------------------

/**
 * Check if the MXE cluster has completed key exchange.
 * Returns the status and the x25519 public key if available.
 * Never throws — returns { ready: false } on failure.
 */
export async function checkMXEReady(
  provider: AnchorProvider,
  programId: PublicKey = PROGRAM_ID,
): Promise<MXEStatus> {
  try {
    const key = await getMXEPublicKey(provider, programId);
    if (key && key.length === 32) {
      return { ready: true, x25519PubKey: key };
    }
    return { ready: false, x25519PubKey: null };
  } catch (err) {
    console.warn("checkMXEReady: failed to fetch MXE public key:", err);
    return { ready: false, x25519PubKey: null };
  }
}

/**
 * Fetch MXE public key with retries. Throws if not available after all attempts.
 */
export async function getMXEPublicKeyWithRetry(
  provider: AnchorProvider,
  programId: PublicKey = PROGRAM_ID,
  maxRetries = 5,
  retryDelayMs = 2000,
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const status = await checkMXEReady(provider, programId);
    if (status.ready && status.x25519PubKey) return status.x25519PubKey;
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  throw new Error(
    "MXE public key not available. MXE cluster nodes may not have completed key exchange.",
  );
}
