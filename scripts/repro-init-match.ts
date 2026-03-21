import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { GameClient } from "../sdk/client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set explicitly before running scripts/repro-init-match.ts`
    );
  }
  return value;
}

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(path, "utf8")))
  );
}

async function main() {
  const rpcUrl = requireEnv("ANCHOR_PROVIDER_URL");
  const walletPath = requireEnv("ANCHOR_WALLET");
  const programId = new PublicKey(requireEnv("FOG_OF_WAR_PROGRAM_ID"));
  const wallet = readKeypair(walletPath);

  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(rpcUrl, "confirmed"),
    new anchor.Wallet(wallet),
    {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    }
  );
  anchor.setProvider(provider);

  const client = new GameClient(provider, undefined, programId, {
    useLegacyDevnetAbi: false,
  });

  const matchId = BigInt(Date.now());

  console.log("rpc", rpcUrl);
  console.log("wallet", wallet.publicKey.toBase58());
  console.log("programId", programId.toBase58());
  console.log("matchId", matchId.toString());

  const created = await client.createMatch(matchId, 2, 42n);
  console.log("createMatch.txSig", created.txSig);
  console.log("createMatch.matchPDA", created.matchPDA.toBase58());

  try {
    await client.awaitComputation(created.computationOffset);
    console.log("createMatch.await", "ok");
  } catch (error) {
    console.log(
      "createMatch.await",
      error instanceof Error ? error.message : String(error)
    );
  }

  const match = await client.fetchMatch(created.matchPDA);
  console.log(
    "postCreate",
    JSON.stringify({
      status: match.status,
      turn: match.turn,
      hiddenStateNonce: match.hiddenStateNonce.toString(),
      players: match.players.map((player) => player.toBase58()),
    })
  );

  const recent = await provider.connection.getSignaturesForAddress(programId, {
    limit: 12,
  });
  for (const entry of recent) {
    const tx = await provider.connection.getTransaction(entry.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const logs = tx?.meta?.logMessages ?? [];
    const sawInitCallback = logs.some((line) =>
      line.includes("Instruction: InitMatchCallback")
    );
    if (!sawInitCallback) continue;

    const interesting = logs.filter(
      (line) =>
        line.includes("Instruction: CallbackComputation") ||
        line.includes("Instruction: InitMatchCallback") ||
        line.includes("failure/abort variant") ||
        line.includes("BLS signature") ||
        line.includes("invalid cluster") ||
        line.includes("invalid computation") ||
        line.includes("output deserialization") ||
        line.includes("custom program error")
    );

    console.log("callback.txSig", entry.signature);
    for (const line of interesting) {
      console.log(" ", line);
    }
    break;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
