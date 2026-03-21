import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  getArciumProgram,
  getArciumProgramId,
  getClusterAccAddress,
  getExecutingPoolAccAddress,
  getMXEAccAddress,
  getMempoolAccAddress,
} from "@arcium-hq/client";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const DEFAULT_PROGRAM_ID = "BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE";

function readArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

async function main() {
  const rpcUrl =
    readArg("rpc") ||
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.QUICKNODE_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    "https://api.devnet.solana.com";
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const clusterOffset = Number.parseInt(readArg("cluster-offset") || "456", 10);
  const programId = new PublicKey(
    readArg("program") ||
      process.env.FOG_OF_WAR_PROGRAM_ID ||
      DEFAULT_PROGRAM_ID
  );
  const wallet = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const arciumProgram = getArciumProgram(provider);
  const arciumProgramId = getArciumProgramId();
  const clusterAddress = getClusterAccAddress(clusterOffset);
  const mxeAddress = getMXEAccAddress(programId);
  const mempoolAddress = getMempoolAccAddress(clusterOffset);
  const execpoolAddress = getExecutingPoolAccAddress(clusterOffset);

  console.log(`RPC: ${new URL(rpcUrl).hostname}`);
  console.log(`Cluster offset: ${clusterOffset}`);
  console.log(`Program: ${programId.toBase58()}`);
  console.log(`Arcium program: ${arciumProgramId.toBase58()}`);

  const [clusterInfo, mxeInfo, mempoolInfo, execpoolInfo] =
    await connection.getMultipleAccountsInfo(
      [clusterAddress, mxeAddress, mempoolAddress, execpoolAddress],
      "confirmed"
    );

  console.log("\nDerived accounts:");
  for (const [label, address, info] of [
    ["cluster", clusterAddress, clusterInfo],
    ["mxe", mxeAddress, mxeInfo],
    ["mempool", mempoolAddress, mempoolInfo],
    ["execpool", execpoolAddress, execpoolInfo],
  ] as const) {
    console.log(
      `  ${label}: ${address.toBase58()} :: ${
        info ? `${info.data.length} bytes` : "missing"
      }`
    );
  }

  try {
    const cluster = await (arciumProgram.account as any).cluster.fetch(
      clusterAddress
    );
    const nodeOffsets = ((cluster.nodes || []) as any[])
      .map((node) => node.offset?.toString?.() ?? String(node.offset))
      .join(", ");
    console.log("\nCluster account:");
    console.log(
      `  size: ${cluster.clusterSize?.toString?.() ?? cluster.clusterSize}`
    );
    console.log(`  activation: ${JSON.stringify(cluster.activation)}`);
    console.log(`  nodes: ${nodeOffsets || "none"}`);
  } catch (error: any) {
    console.log(`\nCluster fetch failed: ${error.message}`);
  }

  const [clusterSigs, arciumSigs] = await Promise.all([
    connection.getSignaturesForAddress(
      clusterAddress,
      { limit: 10 },
      "confirmed"
    ),
    connection.getSignaturesForAddress(
      arciumProgramId,
      { limit: 30 },
      "confirmed"
    ),
  ]);

  console.log(`\nRecent cluster txs: ${clusterSigs.length}`);
  for (const sig of clusterSigs.slice(0, 5)) {
    console.log(
      `  ${sig.signature} :: ${
        sig.err ? `failed ${JSON.stringify(sig.err)}` : "ok"
      }`
    );
  }

  let queueCount = 0;
  let callbackCount = 0;
  let failedCount = 0;

  for (const sig of arciumSigs) {
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    const logs = tx?.meta?.logMessages ?? [];
    if (sig.err) failedCount += 1;
    if (logs.some((line) => /QueueComputation|queue_computation/.test(line)))
      queueCount += 1;
    if (logs.some((line) => /callback|Callback/.test(line))) callbackCount += 1;
  }

  console.log("\nRecent Arcium tx summary:");
  console.log(`  scanned: ${arciumSigs.length}`);
  console.log(`  failed: ${failedCount}`);
  console.log(`  queue hits: ${queueCount}`);
  console.log(`  callback hits: ${callbackCount}`);
}

main().catch((error) => {
  console.error("check-cluster-health failed:", error.message || error);
  process.exit(1);
});
