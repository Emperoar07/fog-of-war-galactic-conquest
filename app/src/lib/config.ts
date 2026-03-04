import { clusterApiUrl } from "@solana/web3.js";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl("devnet");

export const CLUSTER_OFFSET = Number(
  process.env.NEXT_PUBLIC_CLUSTER_OFFSET || "456",
);

export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "devnet") as
  | "devnet"
  | "mainnet-beta";
