import * as anchor from "@coral-xyz/anchor";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { readFileSync } from "fs";
import { GameClient } from "../sdk/client";
import { OrderAction } from "../sdk/constants";
import { generatePlayerKeys } from "../sdk/crypto";

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(path, "utf8"))),
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set explicitly before running scripts/devnet-compat-smoke.ts`,
    );
  }
  return value;
}

async function fundSigner(
  provider: anchor.AnchorProvider,
  recipient: Keypair,
  lamports: number,
): Promise<void> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: recipient.publicKey,
      lamports,
    }),
  );
  await provider.sendAndConfirm(tx, [], {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

async function main() {
  const rpcUrl = requireEnv("ANCHOR_PROVIDER_URL");
  const walletPath = requireEnv("ANCHOR_WALLET");
  const useLegacyDevnetAbi = process.env.USE_LEGACY_DEVNET_ABI === "1";
  const wallet = readKeypair(walletPath);

  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection(rpcUrl, "confirmed"),
    new anchor.Wallet(wallet),
    {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    },
  );
  anchor.setProvider(provider);

  const client = new GameClient(provider, undefined, undefined, {
    useLegacyDevnetAbi,
  });
  const playerTwo = Keypair.generate();
  const playerOneKeys = generatePlayerKeys();
  const playerTwoKeys = generatePlayerKeys();
  const matchId = BigInt(Date.now());

  console.log("rpc", rpcUrl);
  console.log("wallet", wallet.publicKey.toBase58());
  console.log("useLegacyDevnetAbi", useLegacyDevnetAbi);
  console.log("playerTwo", playerTwo.publicKey.toBase58());
  console.log("matchId", matchId.toString());

  await fundSigner(provider, playerTwo, 20_000_000);
  console.log("playerTwo funded");

  const created = await client.createMatch(matchId, 2, 42n);
  console.log("createMatch.txSig", created.txSig);
  console.log("createMatch.matchPDA", created.matchPDA.toBase58());
  await client.awaitComputation(created.computationOffset);
  console.log("createMatch.await", "ok");

  const registerSig = await client.registerPlayer(
    created.matchPDA,
    matchId,
    1,
    playerTwo,
  );
  console.log("registerPlayer.txSig", registerSig);

  let match = await client.fetchMatch(created.matchPDA);
  console.log(
    "postRegister",
    JSON.stringify({
      status: match.status,
      turn: match.turn,
      players: match.players.map((player) => player.toBase58()),
    }),
  );

  const order0 = await client.submitOrders(
    created.matchPDA,
    matchId,
    0,
    { unitSlot: 0, action: OrderAction.Attack, targetX: 6, targetY: 0 },
    playerOneKeys.privateKey,
  );
  console.log("submitP0.txSig", order0.txSig);
  await client.awaitComputation(order0.computationOffset);
  console.log("submitP0.await", "ok");

  const order1 = await client.submitOrders(
    created.matchPDA,
    matchId,
    1,
    { unitSlot: 0, action: OrderAction.Attack, targetX: 0, targetY: 0 },
    playerTwoKeys.privateKey,
    playerTwo,
  );
  console.log("submitP1.txSig", order1.txSig);
  await client.awaitComputation(order1.computationOffset);
  console.log("submitP1.await", "ok");

  match = await client.fetchMatch(created.matchPDA);
  console.log("submittedOrders", match.submittedOrders.join(","));

  const resolved = await client.resolveTurn(created.matchPDA, matchId);
  console.log("resolveTurn.txSig", resolved.txSig);
  await client.awaitComputation(resolved.computationOffset);
  console.log("resolveTurn.await", "ok");

  match = await client.fetchMatch(created.matchPDA);
  console.log("postResolve", JSON.stringify(client.parseBattleSummary(match)));

  const visibility = await client.requestVisibility(
    created.matchPDA,
    matchId,
    playerOneKeys.privateKey,
  );
  console.log("visibility.txSig", visibility.txSig);
  await client.awaitComputation(visibility.computationOffset);
  console.log("visibility.await", "ok");

  match = await client.fetchMatch(created.matchPDA);
  const report = await client.decryptLatestVisibility(
    match,
    playerOneKeys.privateKey,
  );
  console.log("visibility.viewer", match.lastVisibilityViewer);
  console.log("visibility.visibleSlots", report.visibleSlots.join(","));
  console.log("visibility.units", JSON.stringify(report.units));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
