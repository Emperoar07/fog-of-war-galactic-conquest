import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";
import { getArciumProgram, getComputationAccAddress } from "@arcium-hq/client";

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
    process.env.HELIUS_RPC_URL ||
    process.env.QUICKNODE_RPC_URL ||
    "https://api.devnet.solana.com";
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const wallet = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(rpcUrl, "confirmed"),
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const arciumProgram = getArciumProgram(provider);
  const programId = new PublicKey(
    readArg("program") ||
      process.env.FOG_OF_WAR_PROGRAM_ID ||
      DEFAULT_PROGRAM_ID
  );
  const computationArg = readArg("computation");
  const offsetArg = readArg("offset");

  if (!computationArg && !offsetArg) {
    throw new Error("Pass --computation <pubkey> or --offset <u64>.");
  }

  const computationAddress = computationArg
    ? new PublicKey(computationArg)
    : getComputationAccAddress(new anchor.BN(offsetArg!), programId);

  console.log(`RPC: ${new URL(rpcUrl).hostname}`);
  console.log(`Program: ${programId.toBase58()}`);
  console.log(`Computation: ${computationAddress.toBase58()}`);

  const accountInfo = await provider.connection.getAccountInfo(
    computationAddress,
    "confirmed"
  );
  if (!accountInfo) {
    throw new Error("Computation account not found.");
  }
  console.log(`Raw account length: ${accountInfo.data.length}`);

  const computation = await (arciumProgram.account as any).computation.fetch(
    computationAddress
  );
  for (const [key, value] of Object.entries(computation)) {
    const rendered =
      value && typeof (value as any).toBase58 === "function"
        ? (value as any).toBase58()
        : Array.isArray(value)
        ? JSON.stringify(value)
        : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    console.log(`${key}: ${rendered}`);
  }
}

main().catch((error) => {
  console.error("debug-computation failed:", error.message || error);
  process.exit(1);
});
