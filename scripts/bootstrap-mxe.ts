import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  getArciumProgram,
  getArciumProgramId,
  getClusterAccAddress,
  getMXEAccAddress,
  getMXEPublicKey,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  initMxePart1,
  initMxePart2,
} from "@arcium-hq/client";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const DEFAULT_PROGRAM_ID = "BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE";
const DEFAULT_CLUSTER_OFFSET = 456;

function readArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function resolveWalletPath(): string {
  return (
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json")
  );
}

function randomOffset(): anchor.BN {
  return new anchor.BN(
    Buffer.from(Keypair.generate().secretKey.slice(0, 8)),
    "le"
  );
}

function parseNodeOffset(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value?.toString === "function") {
    const parsed = Number.parseInt(value.toString(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function describeUtilityPubkeys(mxe: any): void {
  const utility = mxe.utilityPubkeys;
  if (!utility) {
    console.log("utilityPubkeys: missing");
    return;
  }

  if (utility.set) {
    console.log("utilityPubkeys: SET");
    console.log(
      `x25519: ${Buffer.from(utility.set[0].x25519Pubkey).toString("hex")}`
    );
    return;
  }

  if (utility.unset) {
    const flags = utility.unset[1];
    console.log("utilityPubkeys: UNSET");
    console.log(`participant flags: [${flags.join(", ")}]`);
  }
}

async function main() {
  const rpcUrl =
    readArg("rpc") ||
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.HELIUS_RPC_URL ||
    process.env.QUICKNODE_RPC_URL ||
    "https://api.devnet.solana.com";
  const clusterOffset = Number.parseInt(
    readArg("cluster-offset") ||
      process.env.FOG_OF_WAR_CLUSTER_OFFSET ||
      `${DEFAULT_CLUSTER_OFFSET}`,
    10
  );
  const programId = new PublicKey(
    readArg("program") ||
      process.env.FOG_OF_WAR_PROGRAM_ID ||
      DEFAULT_PROGRAM_ID
  );
  const walletPath = resolveWalletPath();
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new anchor.web3.Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const arciumProgram = getArciumProgram(provider);
  const mxeAddress = getMXEAccAddress(programId);
  const clusterAddress = getClusterAccAddress(clusterOffset);

  console.log(`RPC: ${new URL(rpcUrl).hostname}`);
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`Program: ${programId.toBase58()}`);
  console.log(`Cluster offset: ${clusterOffset}`);
  console.log(`MXE: ${mxeAddress.toBase58()}`);

  const cluster = await (arciumProgram.account as any).cluster.fetch(
    clusterAddress
  );
  const nodeOffsets = ((cluster.nodes || []) as any[])
    .map((node) => parseNodeOffset(node.offset))
    .filter((offset) => offset > 0);

  if (nodeOffsets.length === 0) {
    throw new Error(
      `Cluster ${clusterOffset} has no active nodes. Refusing to initialize MXE.`
    );
  }

  console.log(`Cluster account: ${clusterAddress.toBase58()}`);
  console.log(
    `Cluster size: ${cluster.clusterSize?.toString?.() ?? cluster.clusterSize}`
  );
  console.log(`Active node offsets: ${nodeOffsets.join(", ")}`);

  const existing = await connection.getAccountInfo(mxeAddress, "confirmed");
  if (!existing) {
    console.log("\nMXE account missing. Running initMxePart1/initMxePart2...");
    const part1Sig = await initMxePart1(provider, programId);
    console.log(`initMxePart1: ${part1Sig}`);

    const recoveryPeers = new Array<number>(100).fill(0);
    const requiredPeers = Math.max(4, nodeOffsets.length);
    for (let i = 0; i < Math.min(100, requiredPeers); i += 1) {
      recoveryPeers[i] = nodeOffsets[i % nodeOffsets.length];
    }

    const keygenOffset = randomOffset();
    const keyRecoveryInitOffset = randomOffset();
    const lutOffset = new anchor.BN(await connection.getSlot("confirmed"));

    const part2Sig = await initMxePart2(
      provider,
      clusterOffset,
      programId,
      recoveryPeers,
      keygenOffset,
      keyRecoveryInitOffset,
      lutOffset,
      wallet.publicKey
    );
    console.log(`initMxePart2: ${part2Sig}`);
  } else {
    console.log("\nMXE account already exists. Skipping init.");
  }

  const refreshed = await (arciumProgram.account as any).mxeAccount.fetch(
    mxeAddress
  );
  console.log(`MXE status: ${JSON.stringify(refreshed.status)}`);
  console.log(
    `MXE cluster field: ${refreshed.cluster?.toString?.() ?? "none"}`
  );
  describeUtilityPubkeys(refreshed);

  try {
    const mxePublicKey = await getMXEPublicKey(provider, programId);
    if (mxePublicKey) {
      console.log(
        `getMXEPublicKey: ${Buffer.from(mxePublicKey).toString("hex")}`
      );
    } else {
      console.log("getMXEPublicKey: null");
      console.log(
        "  Hint: try arcium requeue-mxe-keygen <program-id> --cluster-offset <offset> -k <keypair>"
      );
    }
  } catch (error: any) {
    console.log(`getMXEPublicKey error: ${error.message}`);
  }

  // -----------------------------------------------------------------------
  // CompDef initialization (skip-if-exists)
  // -----------------------------------------------------------------------
  console.log("\n--- CompDef Status ---");
  const arciumProgramId = getArciumProgramId();
  const compDefMethods = [
    { method: "initInitMatchCompDef", circuit: "init_match" },
    { method: "initSubmitOrdersCompDef", circuit: "submit_orders" },
    { method: "initVisibilityCheckCompDef", circuit: "visibility_check" },
    { method: "initResolveTurnCompDef", circuit: "resolve_turn" },
  ] as const;

  for (const { circuit } of compDefMethods) {
    const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const offset = getCompDefAccOffset(circuit);
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeed, programId.toBuffer(), offset],
      arciumProgramId
    )[0];

    try {
      await (arciumProgram.account as any).computationDefinitionAccount.fetch(
        compDefPDA
      );
      console.log(`  ${circuit}: initialized`);
    } catch {
      console.log(`  ${circuit}: NOT initialized`);
    }
  }

  // -----------------------------------------------------------------------
  // Overall summary
  // -----------------------------------------------------------------------
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("\n--- Summary ---");
  console.log(
    `  Balance: ${(balance / anchor.web3.LAMPORTS_PER_SOL).toFixed(4)} SOL`
  );
  console.log(`  MXE: ${existing ? "exists" : "initialized this run"}`);
  console.log(
    `  Cluster: ${clusterOffset} (${nodeOffsets.length} active nodes)`
  );
  console.log(
    "  Run tests: RUN_ARCIUM_LOCALNET=1 ARCIUM_CLUSTER_OFFSET=" +
      clusterOffset +
      " npx ts-mocha -p tsconfig.json -t 300000 tests/lifecycle.ts"
  );
}

main().catch((error) => {
  console.error("bootstrap-mxe failed:", error.message || error);
  process.exit(1);
});
