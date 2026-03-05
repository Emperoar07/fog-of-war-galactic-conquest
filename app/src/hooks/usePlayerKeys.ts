"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { generatePlayerKeys } from "@sdk";

/**
 * Manage ephemeral x25519 keys for encrypted order submission.
 * Keys are generated per-session and zeroed on unmount.
 */
export function usePlayerKeys() {
  const [keys, setKeys] = useState<{
    privateKey: Uint8Array;
    publicKey: Uint8Array;
  } | null>(null);

  const keysRef = useRef(keys);

  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  const generate = useCallback(() => {
    if (keysRef.current) {
      keysRef.current.privateKey.fill(0);
    }
    const newKeys = generatePlayerKeys();
    setKeys(newKeys);
    return newKeys;
  }, []);

  const ensureKeys = useCallback(() => {
    if (keys) return keys;
    return generate();
  }, [keys, generate]);

  useEffect(() => {
    return () => {
      if (keysRef.current) {
        keysRef.current.privateKey.fill(0);
      }
    };
  }, []);

  return { keys, generate, ensureKeys };
}
