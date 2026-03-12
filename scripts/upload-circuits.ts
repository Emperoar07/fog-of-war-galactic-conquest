/**
 * Incremental circuit upload script for Fog of War: Galactic Conquest.
 *
 * Uploads circuits one at a time with skip-if-exists logic so partial
 * progress is preserved across runs. Each circuit costs ~2 SOL for
 * on-chain account rent (16-18 resize transactions).
 *
 * Usage (from WSL via anchor wrapper):
 *   npx ts-node scripts/upload-circuits.ts [--circuit <name>]
 *
 * Options:
 *   --circuit <name>   Upload only the named circuit (e.g., init_match)
 *   --check            Just report status, don't upload anything
 *   --init-compdef     Also initialize compDefs if needed (default: true)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";

import {
  getCompDefAccOffset,
  getArciumProgramId,
  uploadCircuit,
  getMXEAccAddress,
  getArciumAccountBaseSeed,
  getLookupTableAddress,
  getArciumProgram,
} from "@arcium-hq/client";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PROGRAM_ID = new PublicKey("BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE");
const LUT_PROGRAM_ID = new PublicKey("AddressLookupTab1e1111111111111111111111111");

const CIRCUITS = [
  { name: "init_match", initMethod: "initInitMatchCompDef" },
  { name: "submit_orders", initMethod: "initSubmitOrdersCompDef" },
  { name: "visibility_check", initMethod: "initVisibilityCheckCompDef" },
  { name: "resolve_turn", initMethod: "initResolveTurnCompDef" },
] as const;

type CircuitLocation = "missing" | "offchain" | "onchain_pending" | "onchain_finalized";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readKpJson(kpPath: string): Keypair {
  const file = fs.readFileSync(kpPath);
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(file.toString())));
}

function getCompDefPDA(programId: PublicKey, circuitName: string): PublicKey {
  const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  const offset = getCompDefAccOffset(circuitName);
  return PublicKey.findProgramAddressSync(
    [baseSeed, programId.toBuffer(), offset],
    getArciumProgramId(),
  )[0];
}

async function isCompDefInitialized(
  arciumProgram: any,
  compDefPDA: PublicKey,
): Promise<boolean> {
  try {
    await arciumProgram.account.computationDefinitionAccount.fetch(compDefPDA);
    return true;
  } catch {
    return false;
  }
}

function getCircuitLocation(compDef: any): CircuitLocation {
  const circuitSource = compDef?.circuitSource;
  if (!circuitSource) return "missing";

  if (circuitSource.offChain) {
    return "offchain";
  }

  const onChain =
    circuitSource.onChain?.[0]
    ?? circuitSource.onChain?.["0"]
    ?? null;
  if (!onChain) return "missing";
  return onChain.isCompleted ? "onchain_finalized" : "onchain_pending";
}

async function getOnchainCircuitLocation(
  arciumProgram: any,
  compDefPDA: PublicKey,
): Promise<CircuitLocation> {
  try {
    const compDef = await arciumProgram.account.computationDefinitionAccount.fetch(compDefPDA);
    return getCircuitLocation(compDef);
  } catch {
    return "missing";
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const circuitFilter = args.includes("--circuit")
    ? args[args.indexOf("--circuit") + 1]
    : null;

  // Setup provider
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL
    || process.env.QUICKNODE_RPC_URL
    || process.env.HELIUS_RPC_URL
    || "https://api.devnet.solana.com";

  const walletPath = process.env.ANCHOR_WALLET
    || path.join(os.homedir(), ".config", "solana", "id.json");

  const wallet = readKpJson(walletPath);
  const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
  const keypairWallet = new anchor.Wallet(wallet);
  const provider = new anchor.AnchorProvider(connection, keypairWallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log(`RPC: ${new URL(rpcUrl).hostname}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  // Load program via IDL
  const idlPath = path.resolve(__dirname, "..", "target", "idl", "fog_of_war_galactic_conquest.json");
  if (!fs.existsSync(idlPath)) {
    console.error("IDL not found at", idlPath);
    process.exit(1);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  const arciumProgram = getArciumProgram(provider);

  // Filter circuits
  const circuits = circuitFilter
    ? CIRCUITS.filter((c) => c.name === circuitFilter)
    : [...CIRCUITS];

  if (circuits.length === 0) {
    console.error(`Unknown circuit: ${circuitFilter}`);
    console.error(`Available: ${CIRCUITS.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }

  // Status check
  console.log("=== Circuit Status ===");
  const statuses: {
    name: string;
    compDefInit: boolean;
    circuitLocation: CircuitLocation;
  }[] = [];

  for (const circuit of circuits) {
    const compDefPDA = getCompDefPDA(PROGRAM_ID, circuit.name);
    const initialized = await isCompDefInitialized(arciumProgram, compDefPDA);
    const circuitLocation = initialized
      ? await getOnchainCircuitLocation(arciumProgram, compDefPDA)
      : "missing";

    statuses.push({ name: circuit.name, compDefInit: initialized, circuitLocation });
    const initStatus = initialized ? "YES" : "NO";
    console.log(
      `  ${circuit.name}: compDef=${initStatus} circuit=${circuitLocation}`,
    );
  }

  const needsInit = statuses.filter((s) => !s.compDefInit);
  const needsUpload = statuses.filter(
    (s) => s.compDefInit && s.circuitLocation === "onchain_pending",
  );
  const done = statuses.filter(
    (s) =>
      s.compDefInit
      && (s.circuitLocation === "offchain" || s.circuitLocation === "onchain_finalized"),
  );

  console.log(`\nSummary: ${done.length} complete, ${needsInit.length} need compDef init, ${needsUpload.length} need circuit upload`);

  if (process.env.FOG_OF_WAR_CIRCUIT_BASE_URL) {
    const baseUrl = process.env.FOG_OF_WAR_CIRCUIT_BASE_URL.replace(/\/+$/, "");
    console.log(`Offchain circuit base URL: ${baseUrl}`);
  }

  if (checkOnly) {
    const estimatedCost = (needsInit.length * 0.01) + (needsUpload.length * 2);
    console.log(`Estimated SOL needed: ~${estimatedCost.toFixed(2)} SOL`);
    process.exit(0);
  }

  // Phase 1: Initialize any missing compDefs
  for (const status of needsInit) {
    const circuit = CIRCUITS.find((c) => c.name === status.name)!;
    console.log(`\n--- Initializing compDef: ${circuit.name} ---`);

    const compDefPDA = getCompDefPDA(PROGRAM_ID, circuit.name);
    const mxeAccount = getMXEAccAddress(PROGRAM_ID);
    const mxeAcc = await (arciumProgram.account as any).mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(PROGRAM_ID, mxeAcc.lutOffsetSlot);
    const arciumProgramId = getArciumProgramId();

    try {
      await (program.methods as any)[circuit.initMethod]()
        .accounts({
          compDefAccount: compDefPDA,
          payer: wallet.publicKey,
          mxeAccount,
          addressLookupTable: lutAddress,
          lutProgram: LUT_PROGRAM_ID,
          arciumProgram: arciumProgramId,
        })
        .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

      console.log(`  compDef ${circuit.name} initialized.`);
      status.compDefInit = true;
    } catch (err: any) {
      console.error(`  Failed to init compDef ${circuit.name}:`, err.message || err);
      continue;
    }
  }

  // Phase 2: Upload circuits one at a time
  const toUpload = statuses.filter(
    (s) => s.compDefInit && s.circuitLocation === "onchain_pending",
  );
  if (toUpload.length === 0) {
    console.log("\nNo on-chain circuit upload required.");
    process.exit(0);
  }

  for (const status of toUpload) {
    const circuit = CIRCUITS.find((c) => c.name === status.name)!;
    const arcisPath = path.resolve(__dirname, "..", "build", `${circuit.name}.arcis`);

    if (!fs.existsSync(arcisPath)) {
      console.error(`  Circuit file not found: ${arcisPath}`);
      continue;
    }

    // Check if we have enough balance (~2 SOL per circuit)
    const currentBalance = await connection.getBalance(wallet.publicKey);
    const balanceSOL = currentBalance / LAMPORTS_PER_SOL;
    console.log(`\n--- Uploading circuit: ${circuit.name} (balance: ${balanceSOL.toFixed(4)} SOL) ---`);

    if (balanceSOL < 1.5) {
      console.warn(`  WARNING: Balance is low (${balanceSOL.toFixed(4)} SOL). Circuit upload requires ~2 SOL.`);
      console.warn(`  Fund wallet ${wallet.publicKey.toBase58()} and re-run.`);
      console.warn(`  Stopping here to preserve remaining SOL.`);
      process.exit(1);
    }

    try {
      const rawCircuit = fs.readFileSync(arcisPath);
      await uploadCircuit(provider, circuit.name, PROGRAM_ID, rawCircuit, true);
      console.log(`  Circuit ${circuit.name} uploaded successfully!`);
      status.circuitLocation = "onchain_finalized";
    } catch (err: any) {
      console.error(`  Failed to upload circuit ${circuit.name}:`, err.message || err);
      console.error(`  Re-run this script to retry.`);
      process.exit(1);
    }
  }

  // Final summary
  const finalBalance = await connection.getBalance(wallet.publicKey);
  console.log(`\n=== Done ===`);
  console.log(`Balance: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  const finalDone = statuses.filter(
    (s) =>
      s.compDefInit
      && (s.circuitLocation === "offchain" || s.circuitLocation === "onchain_finalized"),
  ).length;
  console.log(`Circuits uploaded: ${finalDone}/${statuses.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
