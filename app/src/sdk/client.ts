/* eslint-disable @typescript-eslint/no-explicit-any */

import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { awaitComputationFinalization } from "@arcium-hq/client";
import idl from "./idl/fog_of_war_galactic_conquest.json";
import {
  PROGRAM_ID,
  DEFAULT_CLUSTER_OFFSET,
  NO_WINNER,
  SUMMARY,
  MatchStatus,
} from "./constants";
import type {
  GalaxyMatch,
  BattleSummary,
  OrderParams,
  MXEStatus,
  DecodedVisibilityReport,
  CreateMatchResult,
  QueuedComputationResult,
  VisibilityRequestResult,
  MatchReadyEvent,
  TurnResolvedEvent,
  VisibilitySnapshotReadyEvent,
} from "./types";
import { getMatchPDA } from "./pda";
import { buildQueueComputationAccounts, buildRegisterPlayerAccounts } from "./accounts";
import { decryptVisibilityReport, encryptOrder, checkMXEReady } from "./crypto";
import { onMatchReady, onTurnResolved, onVisibilityReady, removeListener } from "./events";
import { buildLegacyInstruction, sendLegacyInstruction } from "./legacy-abi";

type LegacyAccountMap = Record<string, PublicKey | undefined>;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

// ---------------------------------------------------------------------------
// GameClient
// ---------------------------------------------------------------------------

export class GameClient {
  public readonly program: Program;
  public readonly provider: AnchorProvider;
  public readonly programId: PublicKey;
  public readonly clusterOffset: number;
  public readonly useLegacyDevnetAbi: boolean;

  private mxePublicKey: Uint8Array | null = null;

  constructor(
    provider: AnchorProvider,
    clusterOffset: number = DEFAULT_CLUSTER_OFFSET,
    programId: PublicKey = PROGRAM_ID,
    options: { useLegacyDevnetAbi?: boolean } = {},
  ) {
    this.provider = provider;
    this.programId = programId;
    this.clusterOffset = clusterOffset;
    this.useLegacyDevnetAbi = options.useLegacyDevnetAbi ?? false;
    const programIdl = {
      ...(idl as any),
      address: programId.toBase58(),
    };
    this.program = new Program(programIdl as any, provider);
  }

  // -----------------------------------------------------------------------
  // MXE readiness
  // -----------------------------------------------------------------------

  /** Check if MXE cluster keys are set. Caches result on success. */
  async isReady(): Promise<MXEStatus> {
    if (this.mxePublicKey) {
      return { ready: true, x25519PubKey: this.mxePublicKey };
    }
    const status = await checkMXEReady(this.provider, this.programId);
    if (status.ready && status.x25519PubKey) {
      this.mxePublicKey = status.x25519PubKey;
    }
    return status;
  }

  private async requireMXEKey(): Promise<Uint8Array> {
    const status = await this.isReady();
    if (!status.ready || !status.x25519PubKey) {
      throw new Error(
        "MXE cluster keys not set. Encrypted operations are unavailable.",
      );
    }
    return status.x25519PubKey;
  }

  // -----------------------------------------------------------------------
  // Match lifecycle
  // -----------------------------------------------------------------------

  /** Create a new match. Returns the tx signature and match PDA. */
  async createMatch(
    matchId: bigint,
    playerCount: number = 2,
    mapSeed: bigint = BigInt(42),
  ): Promise<CreateMatchResult> {
    await this.requireMXEKey();
    const computationOffset = new BN(randomBytes(8));
    const [matchPDA] = getMatchPDA(matchId, this.programId);
    const accounts = buildQueueComputationAccounts(
      this.provider.wallet.publicKey,
      "init_match",
      computationOffset,
      this.clusterOffset,
      matchPDA,
      this.programId,
    );

    const txSig = await (this.program.methods as any)
      .createMatch(
        computationOffset,
        new BN(matchId.toString()),
        playerCount,
        new BN(mapSeed.toString()),
      )
      .accountsPartial(accounts)
      .rpc({ commitment: "confirmed", preflightCommitment: "confirmed" });

    return { txSig, computationOffset, matchPDA, matchId };
  }

  /** Wait for an MPC computation to finalize on-chain. */
  async awaitComputation(computationOffset: BN): Promise<void> {
    await awaitComputationFinalization(
      this.provider,
      computationOffset,
      this.programId,
      "confirmed",
    );
  }

  /** Register the connected wallet in a player slot. */
  async registerPlayer(
    matchPDA: PublicKey,
    matchId: bigint,
    slot: number,
    signer?: Keypair,
  ): Promise<string> {
    const player = signer?.publicKey ?? this.provider.wallet.publicKey;
    const accounts = buildRegisterPlayerAccounts(player, matchPDA);

    if (this.useLegacyDevnetAbi) {
      const ix = buildLegacyInstruction(
        "registerPlayer",
        this.programId,
        accounts as unknown as LegacyAccountMap,
        { slot },
      );
      return sendLegacyInstruction(this.provider, ix, signer ? [signer] : []);
    }

    const builder = (this.program.methods as any)
      .registerPlayer(new BN(matchId.toString()), slot)
      .accounts(accounts);

    if (signer) builder.signers([signer]);

    return builder.rpc({ commitment: "confirmed" });
  }

  /** Submit encrypted orders for a player. */
  async submitOrders(
    matchPDA: PublicKey,
    matchId: bigint,
    playerIndex: number,
    order: OrderParams,
    privateKey: Uint8Array,
    signer?: Keypair,
  ): Promise<QueuedComputationResult> {
    const mxeKey = await this.requireMXEKey();
    const encrypted = encryptOrder(order, privateKey, mxeKey);
    const computationOffset = new BN(randomBytes(8));

    const payer = signer?.publicKey ?? this.provider.wallet.publicKey;
    const accounts = buildQueueComputationAccounts(
      payer,
      "submit_orders",
      computationOffset,
      this.clusterOffset,
      matchPDA,
      this.programId,
    );

    if (this.useLegacyDevnetAbi) {
      const ix = buildLegacyInstruction(
        "submitOrders",
        this.programId,
        accounts as unknown as LegacyAccountMap,
        {
          computationOffset,
          playerIndex,
          unitSlotCt: encrypted.unitSlotCt,
          actionCt: encrypted.actionCt,
          targetXCt: encrypted.targetXCt,
          targetYCt: encrypted.targetYCt,
          publicKey: encrypted.publicKey,
          nonceBN: encrypted.nonceBN,
        },
      );
      const txSig = await sendLegacyInstruction(
        this.provider,
        ix,
        signer ? [signer] : [],
      );
      return { txSig, computationOffset };
    }

    const builder = (this.program.methods as any)
      .submitOrders(
        computationOffset,
        new BN(matchId.toString()),
        playerIndex,
        encrypted.unitSlotCt,
        encrypted.actionCt,
        encrypted.targetXCt,
        encrypted.targetYCt,
        encrypted.publicKey,
        encrypted.nonceBN,
      )
      .accountsPartial(accounts);

    if (signer) builder.signers([signer]);

    const txSig = await builder.rpc({
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    return { txSig, computationOffset };
  }

  /** Request a visibility check for the connected wallet. */
  async requestVisibility(
    matchPDA: PublicKey,
    matchId: bigint,
    privateKey: Uint8Array,
    signer?: Keypair,
  ): Promise<VisibilityRequestResult> {
    await this.requireMXEKey();
    const computationOffset = new BN(randomBytes(8));
    const nonce = randomBytes(16);
    const { deserializeLE, x25519 } = await import("@arcium-hq/client");
    const publicKey = x25519.getPublicKey(privateKey);
    const nonceBN = new BN(deserializeLE(nonce).toString());

    const payer = signer?.publicKey ?? this.provider.wallet.publicKey;
    const accounts = buildQueueComputationAccounts(
      payer,
      "visibility_check",
      computationOffset,
      this.clusterOffset,
      matchPDA,
      this.programId,
    );

    if (this.useLegacyDevnetAbi) {
      const ix = buildLegacyInstruction(
        "visibilityCheck",
        this.programId,
        accounts as unknown as LegacyAccountMap,
        {
          computationOffset,
          publicKey: Array.from(publicKey),
          nonceBN,
        },
      );
      const txSig = await sendLegacyInstruction(
        this.provider,
        ix,
        signer ? [signer] : [],
      );
      return {
        txSig,
        computationOffset,
        nonceBN,
        publicKey: Array.from(publicKey),
      };
    }

    const builder = (this.program.methods as any)
      .visibilityCheck(
        computationOffset,
        new BN(matchId.toString()),
        Array.from(publicKey),
        nonceBN,
      )
      .accountsPartial(accounts);

    if (signer) builder.signers([signer]);

    const txSig = await builder.rpc({
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    return {
      txSig,
      computationOffset,
      nonceBN,
      publicKey: Array.from(publicKey),
    };
  }

  /** Trigger turn resolution (requires all players to have submitted). */
  async resolveTurn(
    matchPDA: PublicKey,
    matchId: bigint,
    signer?: Keypair,
  ): Promise<QueuedComputationResult> {
    await this.requireMXEKey();
    const computationOffset = new BN(randomBytes(8));

    const payer = signer?.publicKey ?? this.provider.wallet.publicKey;
    const accounts = buildQueueComputationAccounts(
      payer,
      "resolve_turn",
      computationOffset,
      this.clusterOffset,
      matchPDA,
      this.programId,
    );

    if (this.useLegacyDevnetAbi) {
      const ix = buildLegacyInstruction(
        "resolveTurn",
        this.programId,
        accounts as unknown as LegacyAccountMap,
        { computationOffset },
      );
      const txSig = await sendLegacyInstruction(
        this.provider,
        ix,
        signer ? [signer] : [],
      );
      return { txSig, computationOffset };
    }

    const builder = (this.program.methods as any)
      .resolveTurn(computationOffset, new BN(matchId.toString()))
      .accountsPartial(accounts);

    if (signer) builder.signers([signer]);

    const txSig = await builder.rpc({
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    return { txSig, computationOffset };
  }

  /** Forfeit a match after the turn timeout has expired (60s). */
  async forfeitMatch(
    matchPDA: PublicKey,
    matchId: bigint,
    signer?: Keypair,
  ): Promise<string> {
    const payer = signer?.publicKey ?? this.provider.wallet.publicKey;
    const builder = (this.program.methods as any)
      .forfeitMatch(new BN(matchId.toString()))
      .accounts({ payer, galaxyMatch: matchPDA });

    if (signer) builder.signers([signer]);

    return builder.rpc({ commitment: "confirmed" });
  }

  // -----------------------------------------------------------------------
  // Read state
  // -----------------------------------------------------------------------

  /** Fetch and parse a GalaxyMatch account. */
  async fetchMatch(matchPDA: PublicKey): Promise<GalaxyMatch> {
    const raw = await (this.program.account as any).galaxyMatch.fetch(matchPDA);
    return raw as GalaxyMatch;
  }

  /** Fetch a match by its numeric ID. */
  async fetchMatchByID(matchId: bigint): Promise<GalaxyMatch> {
    const [matchPDA] = getMatchPDA(matchId, this.programId);
    return this.fetchMatch(matchPDA);
  }

  /** Parse the battle_summary array into a structured object. */
  parseBattleSummary(match: GalaxyMatch): BattleSummary {
    const s = match.battleSummary;
    return {
      winner: s[SUMMARY.WINNER],
      destroyedByPlayer: [
        s[SUMMARY.DESTROYED_START],
        s[SUMMARY.DESTROYED_START + 1],
        s[SUMMARY.DESTROYED_START + 2],
        s[SUMMARY.DESTROYED_START + 3],
      ],
      commandFleetAlive: [
        s[SUMMARY.CMD_ALIVE_START] !== 0,
        s[SUMMARY.CMD_ALIVE_START + 1] !== 0,
        s[SUMMARY.CMD_ALIVE_START + 2] !== 0,
        s[SUMMARY.CMD_ALIVE_START + 3] !== 0,
      ],
      nextTurn: s[SUMMARY.NEXT_TURN],
    };
  }

  /** Get the player slot index for a wallet, or null if not registered. */
  getPlayerSlot(match: GalaxyMatch, wallet: PublicKey): number | null {
    const idx = match.players.findIndex(
      (p) => p.toBase58() === wallet.toBase58(),
    );
    return idx >= 0 ? idx : null;
  }

  /** Check if the match is waiting for players. */
  isWaitingForPlayers(match: GalaxyMatch): boolean {
    return match.status === MatchStatus.WaitingForPlayers;
  }

  /** Check if the match is active. */
  isActive(match: GalaxyMatch): boolean {
    return match.status === MatchStatus.Active;
  }

  /** Check if the match is completed. */
  isCompleted(match: GalaxyMatch): boolean {
    return match.status === MatchStatus.Completed;
  }

  /** Check if all active players have submitted orders this turn. */
  allOrdersSubmitted(match: GalaxyMatch): boolean {
    for (let i = 0; i < match.playerCount; i++) {
      if (match.submittedOrders[i] === 0) return false;
    }
    return true;
  }

  /** Get the winner index, or null if no winner yet. */
  getWinner(match: GalaxyMatch): number | null {
    const w = match.battleSummary[SUMMARY.WINNER];
    return w === NO_WINNER ? null : w;
  }

  /** Decrypt and parse the latest visibility report stored on the match account. */
  async decryptLatestVisibility(
    match: GalaxyMatch,
    privateKey: Uint8Array,
  ): Promise<DecodedVisibilityReport> {
    const mxeKey = await this.requireMXEKey();
    return decryptVisibilityReport(
      match.lastVisibility,
      match.lastVisibilityNonce,
      privateKey,
      mxeKey,
    );
  }

  // -----------------------------------------------------------------------
  // Subscriptions
  // -----------------------------------------------------------------------

  onMatchReady(callback: (event: MatchReadyEvent) => void): number {
    return onMatchReady(this.program, callback);
  }

  onTurnResolved(callback: (event: TurnResolvedEvent) => void): number {
    return onTurnResolved(this.program, callback);
  }

  onVisibilityReady(
    callback: (event: VisibilitySnapshotReadyEvent) => void,
  ): number {
    return onVisibilityReady(this.program, callback);
  }

  /** Subscribe to account changes on a match PDA. */
  onMatchAccountChange(
    matchPDA: PublicKey,
    callback: (match: GalaxyMatch) => void,
  ): number {
    return this.provider.connection.onAccountChange(matchPDA, async () => {
      try {
        const match = await this.fetchMatch(matchPDA);
        callback(match);
      } catch {
        // account may be mid-update
      }
    });
  }

  removeListener(id: number): Promise<void> {
    return removeListener(this.program, id);
  }

  removeAccountChangeListener(id: number): Promise<void> {
    return this.provider.connection.removeAccountChangeListener(id).then(() => {});
  }
}
