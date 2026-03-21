/**
 * Diagnostic script: check MXE account state and scan for active clusters.
 * Usage: npx ts-node scripts/check-mxe-status.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  getMXEAccAddress,
  getArciumProgram,
  getClusterAccAddress,
  getMXEPublicKey,
  getArciumProgramId,
} from "@arcium-hq/client";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PROGRAM_ID = new PublicKey(
  process.env.FOG_OF_WAR_PROGRAM_ID ||
    "BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE"
);

async function main() {
  const rpcUrl =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.QUICKNODE_RPC_URL ||
    "https://api.devnet.solana.com";

  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");

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

  console.log(`RPC: ${new URL(rpcUrl).hostname}`);
  console.log(`Arcium Program: ${getArciumProgramId().toBase58()}`);

  const arciumProgram = getArciumProgram(provider);

  // Check our MXE account
  const mxeAddr = getMXEAccAddress(PROGRAM_ID);
  console.log(`\nMXE Account: ${mxeAddr.toBase58()}`);

  const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAddr);
  console.log(`MXE status: ${JSON.stringify(mxeAcc.status)}`);
  console.log(
    `MXE cluster field: ${mxeAcc.cluster ? mxeAcc.cluster.toString() : "none"}`
  );

  const upKeys = mxeAcc.utilityPubkeys as any;
  if (upKeys.set) {
    console.log("utilityPubkeys: SET (keys are ready!)");
    console.log(
      `  x25519: ${Buffer.from(upKeys.set[0].x25519Pubkey).toString("hex")}`
    );
  } else if (upKeys.unset) {
    console.log("utilityPubkeys: UNSET (key exchange incomplete)");
    const flags = upKeys.unset[1];
    console.log(`  participant flags: [${flags.join(", ")}]`);
    console.log(`  all contributed? ${flags.every(Boolean)}`);
    const partial = Buffer.from(upKeys.unset[0].x25519Pubkey);
    const isZero = partial.every((b: number) => b === 0);
    console.log(
      `  x25519 (partial): ${isZero ? "(all zeros)" : partial.toString("hex")}`
    );
  } else {
    console.log("utilityPubkeys: unknown variant", Object.keys(upKeys));
  }

  // Also try getMXEPublicKey directly
  try {
    const pubKey = await getMXEPublicKey(provider, PROGRAM_ID);
    if (pubKey && pubKey.length === 32) {
      console.log(
        `\ngetMXEPublicKey: SUCCESS (${Buffer.from(pubKey).toString("hex")})`
      );
    } else {
      console.log(
        `\ngetMXEPublicKey: returned ${
          pubKey ? `length=${pubKey.length}` : "null"
        }`
      );
    }
  } catch (e: any) {
    console.log(`\ngetMXEPublicKey: error — ${e.message}`);
  }

  // Check cluster 456
  console.log(`\n--- Cluster 456 ---`);
  const clusterAddr = getClusterAccAddress(456);
  console.log(`Address: ${clusterAddr.toBase58()}`);
  try {
    const cluster = (await arciumProgram.account.cluster.fetch(
      clusterAddr
    )) as any;
    console.log(`Cluster size: ${cluster.clusterSize}`);
    console.log(`Activation: ${JSON.stringify(cluster.activation)}`);
    console.log(
      `Authority: ${cluster.authority ? cluster.authority.toBase58() : "none"}`
    );
    console.log(
      `All fields: ${Object.keys(cluster)
        .filter((k) => !k.startsWith("_"))
        .join(", ")}`
    );
  } catch (e: any) {
    console.log(`Fetch error: ${e.message}`);
  }

  // Scan a range of cluster offsets for active ones
  console.log(`\n--- Scanning cluster offsets ---`);
  const offsets = [
    0, 1, 2, 3, 4, 5, 10, 50, 100, 200, 300, 400, 450, 455, 456, 457, 458, 459,
    460, 500,
  ];
  for (const offset of offsets) {
    try {
      const addr = getClusterAccAddress(offset);
      const c = (await arciumProgram.account.cluster.fetch(addr)) as any;
      console.log(
        `  Cluster ${offset}: size=${c.clusterSize} addr=${addr.toBase58()}`
      );
    } catch {
      // not found — skip silently
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
