import { BN } from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}
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
  } catch {
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
