"use client";

import { useState, useCallback } from "react";
import { generatePlayerKeys } from "@sdk";

/**
 * Manage ephemeral x25519 keys for encrypted order submission.
 * Keys are generated per-session and stored in component state.
 */
export function usePlayerKeys() {
  const [keys, setKeys] = useState<{
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  } | null>(null);

  const generate = useCallback(() => {
    const newKeys = generatePlayerKeys();
    setKeys(newKeys);
    return newKeys;
  }, []);

  const ensureKeys = useCallback(() => {
    if (keys) return keys;
    return generate();
  }, [keys, generate]);

  return { keys, generate, ensureKeys };
}
