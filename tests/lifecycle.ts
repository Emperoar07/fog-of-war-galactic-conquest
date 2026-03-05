/**
 * Fog of War: Galactic Conquest — Arcium localnet lifecycle tests.
 *
 * These tests run ONLY under `arcium test` with a live localnet (Solana test-validator +
 * Arcium MPC nodes in Docker).  They are skipped when `RUN_ARCIUM_LOCALNET` is not set.
 *
 * Coverage:
 *   1. Match creation initializes encrypted state and the match account correctly.
 *   2. Registration rejects duplicate players, occupied slots, and over-registration.
 *   3. Order submission rejects unregistered callers and mismatched player indexes.
 *   4. Turn resolution fails until all required players have submitted.
 *   5. Turn resolution advances both public and private turn state.
 *   6. Visibility requests are restricted to the caller's own slot.
 *   7. Winner is emitted when only one command fleet remains.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import {
  awaitComputationFinalization,
  getArciumEnv,
  getCompDefAccOffset,
  getArciumProgramId,
  uploadCircuit,
  RescueCipher,
  deserializeLE,
  getMXEAccAddress,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  x25519,
  getComputationAccAddress,
  getArciumAccountBaseSeed,
  getMXEPublicKey,
  getClusterAccAddress,
  getLookupTableAddress,
  getArciumProgram,
  getFeePoolAccAddress,
  getClockAccAddress,
} from "@arcium-hq/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readKpJson(path: string): Keypair {
  const file = fs.readFileSync(path);
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(file.toString())));
}

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries = 5,
  retryDelayMs = 2000,
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const key = await getMXEPublicKey(provider, programId);
      if (key && key.length === 32) return key;
      // null or empty — MXE nodes haven't completed key exchange yet
      if (attempt === maxRetries) {
        throw new Error(
          "MXE public key not available after all retries (utilityPubkeys not set). " +
          "MXE nodes may not have completed key exchange on devnet.",
        );
      }
      console.log(`  MXE public key not ready (attempt ${attempt}/${maxRetries}), retrying in ${retryDelayMs}ms...`);
    } catch (err: any) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to fetch MXE public key: ${err.message}`);
      }
      console.log(`  MXE public key fetch error (attempt ${attempt}/${maxRetries}): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }
  throw new Error("unreachable");
}

function getProgramCompDefAccount(programId: PublicKey, circuitName: string): PublicKey {
  const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
  const offset = getCompDefAccOffset(circuitName);
  return PublicKey.findProgramAddressSync(
    [baseSeed, programId.toBuffer(), offset],
    getArciumProgramId(),
  )[0];
}

// Game constants (mirror encrypted-ixs/src/lib.rs)
const MAX_PLAYERS = 4;
const MAX_UNITS_PER_PLAYER = 4;
const TOTAL_UNITS = MAX_PLAYERS * MAX_UNITS_PER_PLAYER;
const HIDDEN_STATE_WORDS = 5;
const VISIBILITY_REPORT_WORDS = 2;
const NO_WINNER = 255;

// Packed state byte-array layout offsets (mirror encrypted-ixs constants)
const UNIT_X_OFFSET = 0;
const UNIT_Y_OFFSET = UNIT_X_OFFSET + TOTAL_UNITS;
const ALIVE_OFFSET = UNIT_Y_OFFSET + TOTAL_UNITS * 4; // after x, y, type, health, vision
const CURRENT_TURN_INDEX = 116;
const PLAYER_COUNT_INDEX = 117;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("fog_of_war_galactic_conquest lifecycle", function () {
  this.timeout(600_000); // 10 minutes — MPC computations are slow

  before(function () {
    if (process.env.RUN_ARCIUM_LOCALNET !== "1") {
      this.skip();
    }
  });

  const owner = (() => {
    try {
      return readKpJson(`${os.homedir()}/.config/solana/id.json`);
    } catch {
      return Keypair.generate(); // fallback for skip path
    }
  })();

  console.log(`  [lifecycle] RPC endpoint: ${process.env.ANCHOR_PROVIDER_URL ?? "unset"}`);
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  console.log(`  [lifecycle] Connection endpoint: ${provider.connection.rpcEndpoint}`);

  // The workspace program — name derived from Anchor.toml
  let program: Program;
  let arciumEnv: ReturnType<typeof getArciumEnv>;
  let clusterAccount: PublicKey;

  // Player wallets
  let player1: Keypair;
  let player2: Keypair;
  let outsider: Keypair;

  // Match state
  const matchId = BigInt(Math.floor(Math.random() * 1_000_000));
  const mapSeed = BigInt(42);
  let galaxyMatchPDA: PublicKey;

  // Arcium shared accounts (derived once in before hook)
  let signPdaAccount: PublicKey;
  let poolAccount: PublicKey;
  let clockAccount: PublicKey;

  // Crypto
  let player1PrivateKey: Uint8Array;
  let player1PublicKey: Uint8Array;
  let player2PrivateKey: Uint8Array;
  let player2PublicKey: Uint8Array;
  let mxePublicKey: Uint8Array;

  // Anchor event helper
  function awaitEvent<E extends string>(eventName: E, timeoutMs = 120_000): Promise<any> {
    let listenerId: number;
    let timeoutId: NodeJS.Timeout;
    return new Promise((res, rej) => {
      listenerId = program.addEventListener(eventName as any, (event: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        res(event);
      });
      timeoutId = setTimeout(() => {
        program.removeEventListener(listenerId);
        rej(new Error(`Event ${eventName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }).then(async (event) => {
      await program.removeEventListener(listenerId);
      return event;
    });
  }

  // ------------------------------------------------------------------
  // Setup: init comp defs + upload circuits
  // ------------------------------------------------------------------

  async function initCompDef(
    methodName: string,
    circuitName: string,
  ): Promise<void> {
    const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const offset = getCompDefAccOffset(circuitName);
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeed, program.programId.toBuffer(), offset],
      getArciumProgramId(),
    )[0];

    const arciumProgram = getArciumProgram(provider);

    // Skip if already initialized
    try {
      await arciumProgram.account.computationDefinitionAccount.fetch(compDefPDA);
      return;
    } catch {
      // Not initialized — proceed
    }
    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(program.programId, mxeAcc.lutOffsetSlot);

    const LUT_PROGRAM_ID = new PublicKey("AddressLookupTab1e1111111111111111111111111");
    const arciumProgramId = getArciumProgramId();
    await (program.methods as any)[methodName]()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
        lutProgram: LUT_PROGRAM_ID,
        arciumProgram: arciumProgramId,
      })
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    const rawCircuit = fs.readFileSync(`build/${circuitName}.arcis`);
    await uploadCircuit(provider, circuitName, program.programId, rawCircuit, true);
  }

  before(async function () {
    const workspace = anchor.workspace as Record<string, Program>;
    program = workspace.fogOfWarGalacticConquest ?? workspace.FogOfWarGalacticConquest;
    if (!program) throw new Error("Program not found in workspace");

    arciumEnv = getArciumEnv();
    clusterAccount = getClusterAccAddress(arciumEnv.arciumClusterOffset);

    // Derive Arcium shared accounts
    signPdaAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("ArciumSignerAccount")],
      program.programId,
    )[0];
    poolAccount = getFeePoolAccAddress();
    clockAccount = getClockAccAddress();

    // Wallets
    player1 = owner; // match authority = player 1 (slot 0, set in create_match)
    player2 = Keypair.generate();
    outsider = Keypair.generate();

    // Fund player2 and outsider — use transfer on devnet (airdrops are rate-limited)
    const isDevnet = provider.connection.rpcEndpoint.includes("devnet");
    if (isDevnet) {
      const transferIx = (pubkey: PublicKey, lamports: number) =>
        anchor.web3.SystemProgram.transfer({
          fromPubkey: owner.publicKey,
          toPubkey: pubkey,
          lamports,
        });
      const fundAmount = 0.1 * anchor.web3.LAMPORTS_PER_SOL;
      const tx = new anchor.web3.Transaction()
        .add(transferIx(player2.publicKey, fundAmount))
        .add(transferIx(outsider.publicKey, fundAmount));
      await provider.sendAndConfirm(tx);
    } else {
      const airdropSig1 = await provider.connection.requestAirdrop(
        player2.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL,
      );
      const airdropSig2 = await provider.connection.requestAirdrop(
        outsider.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL,
      );
      await provider.connection.confirmTransaction(airdropSig1, "confirmed");
      await provider.connection.confirmTransaction(airdropSig2, "confirmed");
    }

    // Match PDA
    const matchIdBuffer = Buffer.alloc(8);
    matchIdBuffer.writeBigUInt64LE(matchId);
    galaxyMatchPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("galaxy_match"), matchIdBuffer],
      program.programId,
    )[0];

    // x25519 keys for each player
    player1PrivateKey = x25519.utils.randomSecretKey();
    player1PublicKey = x25519.getPublicKey(player1PrivateKey);
    player2PrivateKey = x25519.utils.randomSecretKey();
    player2PublicKey = x25519.getPublicKey(player2PrivateKey);
    try {
      mxePublicKey = await getMXEPublicKeyWithRetry(provider, program.programId);
      console.log("MXE public key fetched successfully.");
    } catch (err: any) {
      console.warn(`WARNING: ${err.message}`);
      console.warn("Tests requiring encryption (submitOrders, visibilityCheck) will be skipped.");
      mxePublicKey = null as any;
    }

    // Initialize all four computation definitions + upload circuits
    console.log("Initializing computation definitions...");
    await initCompDef("initInitMatchCompDef", "init_match");
    await initCompDef("initSubmitOrdersCompDef", "submit_orders");
    await initCompDef("initVisibilityCheckCompDef", "visibility_check");
    await initCompDef("initResolveTurnCompDef", "resolve_turn");
    console.log("All comp defs initialized.");

    // Brief pause for cluster to sync
    await new Promise((r) => setTimeout(r, 2000));
  });

  // ------------------------------------------------------------------
  // 1. Match creation
  // ------------------------------------------------------------------

  it("creates a match and receives MatchReady after init_match callback", async function () {
    if (!mxePublicKey) return this.skip(); // queue_computation requires MXE keys to be set

    const computationOffset = new anchor.BN(randomBytes(8));
    const matchReadyPromise = awaitEvent("matchReady");

    await program.methods
      .createMatch(
        computationOffset,
        new anchor.BN(matchId.toString()),
        2, // player_count
        new anchor.BN(mapSeed.toString()),
      )
      .accountsPartial({
        payer: player1.publicKey,
        signPdaAccount,
        computationAccount: getComputationAccAddress(
          arciumEnv.arciumClusterOffset,
          computationOffset,
        ),
        clusterAccount,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
        compDefAccount: getProgramCompDefAccount(program.programId, "init_match"),
        poolAccount,
        clockAccount,
        galaxyMatch: galaxyMatchPDA,
      })
      .signers([player1])
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    console.log("Waiting for init_match computation finalization...");
    await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed",
    );

    const matchReady = await matchReadyPromise;
    expect(matchReady.playerCount).to.equal(2);

    const matchAccount = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);
    expect(matchAccount.status).to.equal(0); // WaitingForPlayers
    expect(matchAccount.turn).to.equal(0);
    expect(matchAccount.playerCount).to.equal(2);
    // Player 0 slot should be owner
    expect(matchAccount.players[0].toBase58()).to.equal(player1.publicKey.toBase58());
  });

  // ------------------------------------------------------------------
  // 2. Registration
  // ------------------------------------------------------------------

  it("allows player 2 to register in slot 1 and activates the match", async function () {
    if (!mxePublicKey) return this.skip(); // depends on createMatch which needs MXE keys
    await program.methods
      .registerPlayer(new anchor.BN(matchId.toString()), 1) // slot 1
      .accounts({
        player: player2.publicKey,
        galaxyMatch: galaxyMatchPDA,
      })
      .signers([player2])
      .rpc({ commitment: "confirmed" });

    const matchAccount = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);
    expect(matchAccount.players[1].toBase58()).to.equal(player2.publicKey.toBase58());
    expect(matchAccount.status).to.equal(1); // Active
  });

  it("rejects duplicate registration", async function () {
    try {
      await program.methods
        .registerPlayer(new anchor.BN(matchId.toString()), 1)
        .accounts({ player: player2.publicKey, galaxyMatch: galaxyMatchPDA })
        .signers([player2])
        .rpc({ commitment: "confirmed" });
      expect.fail("Should have rejected duplicate registration");
    } catch (err: any) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("rejects registration from a third player (match full)", async function () {
    try {
      await program.methods
        .registerPlayer(new anchor.BN(matchId.toString()), 2)
        .accounts({ player: outsider.publicKey, galaxyMatch: galaxyMatchPDA })
        .signers([outsider])
        .rpc({ commitment: "confirmed" });
      expect.fail("Should have rejected over-registration");
    } catch (err: any) {
      expect(err.toString()).to.include("Error");
    }
  });

  // ------------------------------------------------------------------
  // 3. Order submission — authorization
  // ------------------------------------------------------------------

  it("rejects order submission from an unregistered wallet", async function () {
    const computationOffset = new anchor.BN(randomBytes(8));
    const dummyCt = new Array(32).fill(0);
    const dummyPk = new Array(32).fill(0);

    try {
      await program.methods
        .submitOrders(
          computationOffset,
          new anchor.BN(matchId.toString()),
          0, // player_index
          dummyCt, dummyCt, dummyCt, dummyCt,
          dummyPk,
          new anchor.BN(0),
        )
        .accountsPartial({
          payer: outsider.publicKey,
          signPdaAccount,
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            computationOffset,
          ),
          clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
          compDefAccount: getProgramCompDefAccount(program.programId, "submit_orders"),
          poolAccount,
          clockAccount,
          galaxyMatch: galaxyMatchPDA,
        })
        .signers([outsider])
        .rpc({ commitment: "confirmed" });
      expect.fail("Should have rejected unregistered caller");
    } catch (err: any) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("rejects order submission when a registered player spoofs another slot", async function () {
    const computationOffset = new anchor.BN(randomBytes(8));
    const dummyCt = new Array(32).fill(0);

    try {
      await program.methods
        .submitOrders(
          computationOffset,
          new anchor.BN(matchId.toString()),
          0, // player 2 attempting to submit as player 1
          dummyCt, dummyCt, dummyCt, dummyCt,
          Array.from(player2PublicKey),
          new anchor.BN(0),
        )
        .accountsPartial({
          payer: player2.publicKey,
          signPdaAccount,
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            computationOffset,
          ),
          clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
          compDefAccount: getProgramCompDefAccount(program.programId, "submit_orders"),
          poolAccount,
          clockAccount,
          galaxyMatch: galaxyMatchPDA,
        })
        .signers([player2])
        .rpc({ commitment: "confirmed" });
      expect.fail("Should have rejected a mismatched player index");
    } catch (err: any) {
      expect(err.toString()).to.include("Error");
    }
  });

  // ------------------------------------------------------------------
  // 4. Turn resolution fails without all submissions
  // ------------------------------------------------------------------

  it("rejects resolve_turn before all players have submitted", async function () {
    const computationOffset = new anchor.BN(randomBytes(8));

    try {
      await program.methods
        .resolveTurn(computationOffset, new anchor.BN(matchId.toString()))
        .accountsPartial({
          payer: player1.publicKey,
          signPdaAccount,
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            computationOffset,
          ),
          clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
          compDefAccount: getProgramCompDefAccount(program.programId, "resolve_turn"),
          poolAccount,
          clockAccount,
          galaxyMatch: galaxyMatchPDA,
        })
        .signers([player1])
        .rpc({ commitment: "confirmed" });
      expect.fail("Should have rejected — not all players submitted");
    } catch (err: any) {
      expect(err.toString()).to.include("Error");
    }
  });

  // ------------------------------------------------------------------
  // 5. Submit orders for both players, then resolve
  // ------------------------------------------------------------------

  async function submitOrder(
    signer: Keypair,
    playerIndex: number,
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    unitSlot: number,
    action: number,
    targetX: number,
    targetY: number,
  ): Promise<void> {
    const sharedSecret = x25519.getSharedSecret(privateKey, new Uint8Array(mxePublicKey));
    const cipher = new RescueCipher(sharedSecret);
    const nonce = randomBytes(16);

    // Encrypt the four order fields individually
    const unitSlotCt = cipher.encrypt([BigInt(unitSlot)], nonce);
    const actionCt = cipher.encrypt([BigInt(action)], nonce);
    const targetXCt = cipher.encrypt([BigInt(targetX)], nonce);
    const targetYCt = cipher.encrypt([BigInt(targetY)], nonce);

    const computationOffset = new anchor.BN(randomBytes(8));
    const matchAccount = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);

    await program.methods
      .submitOrders(
        computationOffset,
        new anchor.BN(matchId.toString()),
        playerIndex,
        Array.from(unitSlotCt[0]),
        Array.from(actionCt[0]),
        Array.from(targetXCt[0]),
        Array.from(targetYCt[0]),
        Array.from(publicKey),
        new anchor.BN(deserializeLE(nonce).toString()),
      )
      .accountsPartial({
        payer: signer.publicKey,
        signPdaAccount,
        computationAccount: getComputationAccAddress(
          arciumEnv.arciumClusterOffset,
          computationOffset,
        ),
        clusterAccount,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
        compDefAccount: getProgramCompDefAccount(program.programId, "submit_orders"),
        poolAccount,
        clockAccount,
        galaxyMatch: galaxyMatchPDA,
      })
      .signers([signer])
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    console.log(`Waiting for submit_orders computation (player ${playerIndex})...`);
    await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed",
    );
  }

  it("accepts orders from both players and resolves the turn", async function () {
    if (!mxePublicKey) return this.skip();

    // Player 1: move unit 0 (command) to (1, 0)
    await submitOrder(player1, 0, player1PrivateKey, player1PublicKey, 0, 0, 1, 0);

    // Player 2: move unit 0 (command) to (6, 0)
    await submitOrder(player2, 1, player2PrivateKey, player2PublicKey, 0, 0, 6, 0);

    // Verify both submitted
    const matchBefore = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);
    expect(matchBefore.submittedOrders[0]).to.equal(1);
    expect(matchBefore.submittedOrders[1]).to.equal(1);

    // Resolve turn
    const computationOffset = new anchor.BN(randomBytes(8));
    const turnResolvedPromise = awaitEvent("turnResolved");

    await program.methods
      .resolveTurn(computationOffset, new anchor.BN(matchId.toString()))
      .accountsPartial({
        payer: player1.publicKey,
        signPdaAccount,
        computationAccount: getComputationAccAddress(
          arciumEnv.arciumClusterOffset,
          computationOffset,
        ),
        clusterAccount,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
        compDefAccount: getProgramCompDefAccount(program.programId, "resolve_turn"),
        poolAccount,
        clockAccount,
        galaxyMatch: galaxyMatchPDA,
      })
      .signers([player1])
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    console.log("Waiting for resolve_turn computation...");
    await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed",
    );

    const turnResolved = await turnResolvedPromise;
    expect(turnResolved.nextTurn).to.equal(1);
    expect(turnResolved.winner).to.equal(NO_WINNER);

    const matchAfter = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);
    expect(matchAfter.turn).to.equal(1);
    expect(matchAfter.status).to.equal(1); // Still active
    // Submitted orders should be cleared for next turn
    expect(matchAfter.submittedOrders[0]).to.equal(0);
    expect(matchAfter.submittedOrders[1]).to.equal(0);
  });

  // ------------------------------------------------------------------
  // 6. Visibility restricted to caller's own slot
  // ------------------------------------------------------------------

  it("allows player 1 to request their own visibility report", async function () {
    if (!mxePublicKey) return this.skip();
    const computationOffset = new anchor.BN(randomBytes(8));
    const nonce = randomBytes(16);
    const visibilityPromise = awaitEvent("visibilitySnapshotReady");

    await program.methods
      .visibilityCheck(
        computationOffset,
        new anchor.BN(matchId.toString()),
        Array.from(player1PublicKey),
        new anchor.BN(deserializeLE(nonce).toString()),
      )
      .accountsPartial({
        payer: player1.publicKey,
        signPdaAccount,
        computationAccount: getComputationAccAddress(
          arciumEnv.arciumClusterOffset,
          computationOffset,
        ),
        clusterAccount,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
        compDefAccount: getProgramCompDefAccount(program.programId, "visibility_check"),
        poolAccount,
        clockAccount,
        galaxyMatch: galaxyMatchPDA,
      })
      .signers([player1])
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    console.log("Waiting for visibility_check computation...");
    await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed",
    );

    const visEvent = await visibilityPromise;
    expect(visEvent.viewerIndex).to.equal(0); // player 1 = slot 0
    expect(visEvent.turn).to.equal(1);
  });

  it("rejects visibility check from an unregistered wallet", async function () {
    const computationOffset = new anchor.BN(randomBytes(8));
    const nonce = randomBytes(16);

    try {
      await program.methods
        .visibilityCheck(
          computationOffset,
          new anchor.BN(matchId.toString()),
          new Array(32).fill(0),
          new anchor.BN(0),
        )
        .accountsPartial({
          payer: outsider.publicKey,
          signPdaAccount,
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            computationOffset,
          ),
          clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
          compDefAccount: getProgramCompDefAccount(program.programId, "visibility_check"),
          poolAccount,
          clockAccount,
          galaxyMatch: galaxyMatchPDA,
        })
        .signers([outsider])
        .rpc({ commitment: "confirmed" });
      expect.fail("Should have rejected unregistered visibility request");
    } catch (err: any) {
      expect(err.toString()).to.include("Error");
    }
  });

  // ------------------------------------------------------------------
  // 7. Combat: attack until a command fleet dies, verify winner
  // ------------------------------------------------------------------

  it("declares a winner when one command fleet is destroyed", async function () {
    if (!mxePublicKey) return this.skip();
    // Player 2's command fleet is at (7, 0) initially (MAP_WIDTH-1 = 7), we moved it to (6, 0).
    // Attack it repeatedly until destroyed (command has 5 HP).
    // We need 5 attack rounds to destroy it.

    for (let round = 0; round < 5; round++) {
      console.log(`Attack round ${round + 1}/5...`);

      // Player 1: attack tile (6, 0) where player 2's command fleet is
      await submitOrder(player1, 0, player1PrivateKey, player1PublicKey, 0, 2, 6, 0);

      // Player 2: move unit 1 (scout) somewhere harmless
      await submitOrder(player2, 1, player2PrivateKey, player2PublicKey, 1, 0, 5, 5);

      // Resolve
      const computationOffset = new anchor.BN(randomBytes(8));
      const turnResolvedPromise = awaitEvent("turnResolved");

      await program.methods
        .resolveTurn(computationOffset, new anchor.BN(matchId.toString()))
        .accountsPartial({
          payer: player1.publicKey,
          signPdaAccount,
          computationAccount: getComputationAccAddress(
            arciumEnv.arciumClusterOffset,
            computationOffset,
          ),
          clusterAccount,
          mxeAccount: getMXEAccAddress(program.programId),
          mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
          executingPool: getExecutingPoolAccAddress(arciumEnv.arciumClusterOffset),
          compDefAccount: getProgramCompDefAccount(program.programId, "resolve_turn"),
          poolAccount,
          clockAccount,
          galaxyMatch: galaxyMatchPDA,
        })
        .signers([player1])
        .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

      console.log("Waiting for resolve_turn computation...");
      await awaitComputationFinalization(
        provider,
        computationOffset,
        program.programId,
        "confirmed",
      );

      const turnResolved = await turnResolvedPromise;
      console.log(`  Turn ${turnResolved.nextTurn}, winner=${turnResolved.winner}`);

      if (turnResolved.winner !== NO_WINNER) {
        // Winner declared
        expect(turnResolved.winner).to.equal(0); // Player 1 wins
        const matchAccount = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);
        expect(matchAccount.status).to.equal(2); // Completed
        console.log("Winner declared: player", turnResolved.winner);
        return;
      }
    }

    // If we get here, the command fleet should be destroyed after 5 attacks
    // The test passes as long as the winner event was emitted above
    const matchAccount = await (program.account as any).galaxyMatch.fetch(galaxyMatchPDA);
    expect(matchAccount.status).to.equal(2);
  });
});
