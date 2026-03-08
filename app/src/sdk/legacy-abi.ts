import { BN, AnchorProvider } from "@coral-xyz/anchor";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import idl from "./idl/fog_of_war_galactic_conquest.json";

type LegacyInstructionName =
  | "registerPlayer"
  | "submitOrders"
  | "visibilityCheck"
  | "resolveTurn";

type LegacyRegisterPlayerArgs = {
  slot: number;
};

type LegacySubmitOrdersArgs = {
  computationOffset: BN;
  playerIndex: number;
  unitSlotCt: number[];
  actionCt: number[];
  targetXCt: number[];
  targetYCt: number[];
  publicKey: number[];
  nonceBN: BN;
};

type LegacyVisibilityCheckArgs = {
  computationOffset: BN;
  publicKey: number[];
  nonceBN: BN;
};

type LegacyResolveTurnArgs = {
  computationOffset: BN;
};

type LegacyInstructionArgs =
  | LegacyRegisterPlayerArgs
  | LegacySubmitOrdersArgs
  | LegacyVisibilityCheckArgs
  | LegacyResolveTurnArgs;

type AccountMap = Record<string, PublicKey>;

type IdlAccountDef = {
  name: string;
  writable?: boolean;
  signer?: boolean;
  address?: string;
};

type IdlInstructionDef = {
  name: string;
  discriminator: number[];
  accounts: IdlAccountDef[];
};

const BYTE_MASK = BigInt(0xff);
const BYTE_SHIFT = BigInt(8);

function getInstructionDef(name: LegacyInstructionName): IdlInstructionDef {
  const instructions = (idl as { instructions: IdlInstructionDef[] }).instructions;
  const instruction = instructions.find((ix) => ix.name === name);
  if (!instruction) {
    throw new Error(`Missing instruction definition for ${name}`);
  }
  return instruction;
}

function toBigIntLE(value: BN | bigint | number): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value.toString());
}

function encodeU8(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff);
}

function encodeU64(value: BN | bigint | number): Uint8Array {
  let remaining = toBigIntLE(value);
  const bytes = new Uint8Array(8);
  for (let index = 0; index < 8; index += 1) {
    bytes[index] = Number(remaining & BYTE_MASK);
    remaining >>= BYTE_SHIFT;
  }
  return bytes;
}

function encodeU128(value: BN | bigint | number): Uint8Array {
  let remaining = toBigIntLE(value);
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    bytes[index] = Number(remaining & BYTE_MASK);
    remaining >>= BYTE_SHIFT;
  }
  return bytes;
}

function encodeFixed32(values: number[], field: string): Uint8Array {
  if (values.length !== 32) {
    throw new Error(`${field} must be exactly 32 bytes`);
  }
  return Uint8Array.from(values);
}

function concatBytes(...parts: Uint8Array[]): Buffer {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return Buffer.from(output);
}

function encodeLegacyInstructionData(
  name: LegacyInstructionName,
  args: LegacyInstructionArgs,
): Buffer {
  const discriminator = Uint8Array.from(getInstructionDef(name).discriminator);

  switch (name) {
    case "registerPlayer": {
      const { slot } = args as LegacyRegisterPlayerArgs;
      return concatBytes(discriminator, encodeU8(slot));
    }
    case "submitOrders": {
      const {
        computationOffset,
        playerIndex,
        unitSlotCt,
        actionCt,
        targetXCt,
        targetYCt,
        publicKey,
        nonceBN,
      } = args as LegacySubmitOrdersArgs;
      return concatBytes(
        discriminator,
        encodeU64(computationOffset),
        encodeU8(playerIndex),
        encodeFixed32(unitSlotCt, "unitSlotCt"),
        encodeFixed32(actionCt, "actionCt"),
        encodeFixed32(targetXCt, "targetXCt"),
        encodeFixed32(targetYCt, "targetYCt"),
        encodeFixed32(publicKey, "publicKey"),
        encodeU128(nonceBN),
      );
    }
    case "visibilityCheck": {
      const { computationOffset, publicKey, nonceBN } =
        args as LegacyVisibilityCheckArgs;
      return concatBytes(
        discriminator,
        encodeU64(computationOffset),
        encodeFixed32(publicKey, "publicKey"),
        encodeU128(nonceBN),
      );
    }
    case "resolveTurn": {
      const { computationOffset } = args as LegacyResolveTurnArgs;
      return concatBytes(discriminator, encodeU64(computationOffset));
    }
  }
}

function buildAccountMetas(
  name: LegacyInstructionName,
  accounts: AccountMap | Record<string, PublicKey | undefined>,
): AccountMeta[] {
  const instruction = getInstructionDef(name);
  const accountMap = accounts as Record<string, PublicKey | undefined>;

  return instruction.accounts.map((accountDef) => {
    const pubkey = accountDef.address
      ? new PublicKey(accountDef.address)
      : accountMap[accountDef.name];

    if (!pubkey) {
      throw new Error(`Missing account for ${name}.${accountDef.name}`);
    }

    return {
      pubkey,
      isSigner: Boolean(accountDef.signer),
      isWritable: Boolean(accountDef.writable),
    };
  });
}

export function buildLegacyInstruction(
  name: LegacyInstructionName,
  programId: PublicKey,
  accounts: AccountMap | Record<string, PublicKey | undefined>,
  args: LegacyInstructionArgs,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: buildAccountMetas(name, accounts),
    data: encodeLegacyInstructionData(name, args),
  });
}

export async function sendLegacyInstruction(
  provider: AnchorProvider,
  instruction: TransactionInstruction,
  signers: Keypair[] = [],
): Promise<string> {
  const tx = new Transaction().add(instruction);
  return provider.sendAndConfirm(tx, signers, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}
