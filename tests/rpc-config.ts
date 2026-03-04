import { Connection } from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

/**
 * Multi-RPC connection pool with automatic failover.
 * Reads endpoints from .env (private) with a public fallback.
 */

const RPC_ENDPOINTS: string[] = [
  process.env.HELIUS_RPC_URL,
  process.env.QUICKNODE_RPC_URL,
  process.env.PUBLIC_RPC_URL,
].filter(Boolean) as string[];

if (RPC_ENDPOINTS.length === 0) {
  RPC_ENDPOINTS.push("https://api.devnet.solana.com");
}

let currentIndex = 0;

/** Get the primary RPC URL (first available private endpoint). */
export function getRpcUrl(): string {
  return RPC_ENDPOINTS[currentIndex] || RPC_ENDPOINTS[0];
}

/** Get a fresh Connection, optionally rotating to the next endpoint. */
export function getConnection(commitment: "confirmed" | "finalized" = "confirmed"): Connection {
  return new Connection(getRpcUrl(), commitment);
}

/** Rotate to the next RPC endpoint (call on repeated failures). */
export function rotateRpc(): string {
  currentIndex = (currentIndex + 1) % RPC_ENDPOINTS.length;
  const url = RPC_ENDPOINTS[currentIndex];
  const host = new URL(url).hostname;
  console.log(`  [rpc] rotated to ${host}`);
  return url;
}

/** Get the WebSocket URL for subscriptions. */
export function getWssUrl(): string {
  return process.env.QUICKNODE_WSS_URL || getRpcUrl().replace("https://", "wss://");
}
