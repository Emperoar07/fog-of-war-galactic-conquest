import { clusterApiUrl } from "@solana/web3.js";

const rawRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");
export const RPC_URL =
  rawRpcUrl.startsWith("https://") || rawRpcUrl.startsWith("http://localhost")
    ? rawRpcUrl
    : clusterApiUrl("devnet");

export const CLUSTER_OFFSET = Number(
  process.env.NEXT_PUBLIC_CLUSTER_OFFSET || "456",
);

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "devnet") as
  | "devnet"
  | "mainnet-beta";

export const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
