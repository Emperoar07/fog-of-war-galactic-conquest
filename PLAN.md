# Implementation Plan: Game Client SDK + Next.js Frontend

## Overview

Build two things:
1. **`sdk/`** — standalone TypeScript library wrapping all program interactions
2. **`app/`** — Next.js 14 App Router frontend deployable to Vercel

The SDK is a pure TypeScript module (no React/Next.js). The frontend imports the SDK.

---

## Phase 1: Game Client SDK (`sdk/`)

### File Structure

```
sdk/
├── index.ts              — public barrel export
├── constants.ts          — program ID, game constants, seeds, enums
├── types.ts              — TypeScript types for on-chain state, events, orders
├── pda.ts                — all PDA derivations (match, signPda, arcium accounts)
├── accounts.ts           — build full account sets for each instruction
├── crypto.ts             — x25519 key gen, shared secret, RescueCipher encrypt/decrypt
├── client.ts             — high-level GameClient class
├── events.ts             — event subscription helpers
└── idl.ts                — re-export of the hand-crafted IDL JSON
```

### `constants.ts`
- `PROGRAM_ID` — `BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE`
- `ARCIUM_PROGRAM_ID` — `Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ`
- Game constants: `MAX_PLAYERS=4`, `MAP_SIZE=8`, `UNITS_PER_PLAYER=4`, `HIDDEN_STATE_WORDS=5`, `VISIBILITY_REPORT_WORDS=2`, `NO_WINNER=255`, `NO_PLAYER=255`
- Status enum: `MatchStatus { WaitingForPlayers=0, Active=1, Completed=2 }`
- Action enum: `OrderAction { Move=0, Scout=1, Attack=2 }`
- Unit types: `UnitType { Command=0, Scout=1, Frigate=2, Destroyer=3 }`
- PDA seeds: `GALAXY_MATCH_SEED="galaxy_match"`, `SIGN_PDA_SEED="ArciumSignerAccount"`
- `battleSummary` layout: `[winner, destroyed[0..3], cmdAlive[0..3], nextTurn]`

### `types.ts`
```ts
interface GalaxyMatch {
  matchId: BN; authority: PublicKey; players: PublicKey[];
  playerCount: number; turn: number; status: MatchStatus;
  mapSeed: BN; revealedSectorOwner: number[]; battleSummary: number[];
  submittedOrders: number[];
  hiddenState: number[][]; hiddenStateNonce: BN;
  lastVisibility: number[][]; lastVisibilityNonce: BN;
  lastVisibilityViewer: number;
}

interface MatchReadyEvent { matchId: BN; playerCount: number; }
interface TurnResolvedEvent { matchId: BN; winner: number; nextTurn: number; }
interface VisibilitySnapshotReadyEvent { matchId: BN; turn: number; viewerIndex: number; }

interface OrderParams { unitSlot: number; action: OrderAction; targetX: number; targetY: number; }
interface BattleSummary { winner: number; destroyedByPlayer: number[]; commandFleetAlive: boolean[]; nextTurn: number; }
interface MXEStatus { ready: boolean; x25519PubKey: Uint8Array | null; }
```

### `pda.ts`
- `getMatchPDA(matchId: bigint | BN): [PublicKey, number]`
- `getSignPDA(): PublicKey`
- `getCompDefPDA(circuitName: string): PublicKey` — uses correct `findProgramAddressSync` derivation (not the buggy `getCompDefAccAddress`)
- Re-exports Arcium helpers: `getMXEAccAddress`, `getMempoolAccAddress`, `getExecutingPoolAccAddress`, `getComputationAccAddress`, `getClusterAccAddress`, `getFeePoolAccAddress`, `getClockAccAddress`

### `accounts.ts`
- `buildQueueComputationAccounts(circuitName, computationOffset, clusterOffset, matchPDA)` — returns full account object for createMatch/submitOrders/visibilityCheck/resolveTurn
- `buildRegisterPlayerAccounts(matchPDA)` — simple 2-account object
- Internally derives all Arcium PDAs (sign, mxe, mempool, execpool, computation, compDef, cluster, pool, clock)

### `crypto.ts`
- `generatePlayerKeys(): { privateKey: Uint8Array; publicKey: Uint8Array }`
- `getMXEPublicKeyWithRetry(provider, retries?, delay?): Promise<Uint8Array>`
- `checkMXEReady(provider): Promise<MXEStatus>` — non-throwing readiness check
- `encryptOrder(order: OrderParams, sharedSecret: Uint8Array): { ciphertexts, nonce, nonceBN, publicKey }` — handles RescueCipher encryption + nonce generation
- `deriveSharedSecret(privateKey, mxePublicKey): Uint8Array`

### `client.ts` — `GameClient` class
```ts
class GameClient {
  constructor(provider: AnchorProvider, clusterOffset?: number);

  // Readiness
  isReady(): Promise<MXEStatus>;

  // Match lifecycle
  createMatch(matchId: bigint, playerCount: number, mapSeed: bigint): Promise<{ txSig: string; matchPDA: PublicKey }>;
  registerPlayer(matchPDA: PublicKey, slot: number): Promise<string>;
  submitOrders(matchPDA: PublicKey, playerIndex: number, order: OrderParams, privateKey: Uint8Array): Promise<string>;
  requestVisibility(matchPDA: PublicKey, privateKey: Uint8Array): Promise<string>;
  resolveTurn(matchPDA: PublicKey): Promise<string>;

  // Read state
  fetchMatch(matchPDA: PublicKey): Promise<GalaxyMatch>;
  fetchMatchByID(matchId: bigint): Promise<GalaxyMatch>;
  parseBattleSummary(match: GalaxyMatch): BattleSummary;
  getPlayerSlot(match: GalaxyMatch, wallet: PublicKey): number | null;

  // Subscriptions
  onMatchReady(callback): number;
  onTurnResolved(callback): number;
  onVisibilityReady(callback): number;
  onMatchAccountChange(matchPDA, callback): number;
  removeListener(id: number): void;
}
```

### `events.ts`
- Typed event subscription wrappers around `program.addEventListener`
- Auto-filtering by matchId where applicable

### `idl.ts`
- `import idl from "../../target/idl/fog_of_war_galactic_conquest.json"`
- Re-export for consumer use

---

## Phase 2: Next.js Frontend (`app/`)

### Setup
- `npx create-next-app@latest app --typescript --tailwind --app --src-dir --no-import-alias`
- Add dependencies: `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/web3.js`, `@coral-xyz/anchor`
- Configure `next.config.js` for Solana (webpack fallbacks for `fs`, `crypto`, etc.)
- Environment: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CLUSTER_OFFSET`

### File Structure

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          — root layout with wallet provider
│   │   ├── page.tsx            — landing / lobby page
│   │   └── match/
│   │       └── [id]/
│   │           └── page.tsx    — game view page
│   ├── components/
│   │   ├── WalletProvider.tsx  — Solana wallet adapter context
│   │   ├── Lobby.tsx           — match list + create match
│   │   ├── CreateMatchModal.tsx — match creation form
│   │   ├── GameBoard.tsx       — 8x8 grid display
│   │   ├── GameCell.tsx        — single grid cell
│   │   ├── OrderPanel.tsx      — order submission form
│   │   ├── TurnStatus.tsx      — turn info bar
│   │   ├── BattleSummary.tsx   — battle results display
│   │   ├── PlayerInfo.tsx      — player wallet + slot info
│   │   └── MXEStatusBanner.tsx — MXE readiness indicator
│   ├── hooks/
│   │   ├── useGameClient.ts    — singleton GameClient hook
│   │   ├── useMatch.ts         — fetch + subscribe to match state
│   │   └── usePlayerKeys.ts    — x25519 key management (sessionStorage)
│   └── lib/
│       └── config.ts           — env vars, RPC config
├── public/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Key Pages

**`/` — Lobby**
- Connect wallet button
- MXE status banner (green = ready, yellow = keys not set)
- "Create Match" button → modal with mapSeed input
- List of recent matches (fetch GalaxyMatch accounts via `getProgramAccounts` filtered by status)
- Click match → navigate to `/match/[id]`

**`/match/[id]` — Game View**
- Fetch match state by matchId
- Show: 8x8 grid, turn number, match status, players, battle summary
- If WaitingForPlayers: show "Join Match" button (registerPlayer)
- If Active + player's turn to submit: show OrderPanel
- If Active + all submitted: show "Resolve Turn" button
- Visibility: button to request visibility check, overlay visible enemy positions on grid
- If Completed: show winner, final summary

### Key Components

**`GameBoard`** — 8x8 CSS grid
- Cells colored by `revealedSectorOwner` (neutral, player1, player2)
- Overlay icons for visible enemy units (from visibility report)
- Highlight selected unit and target for order submission

**`OrderPanel`** — form with:
- Unit selector (dropdown: command, scout, frigate, destroyer)
- Action selector (move / scout / attack)
- Target tile picker (click on grid or enter x,y)
- Submit button → calls `gameClient.submitOrders()`

**`TurnStatus`** — status bar showing:
- Turn number, match status
- Who has submitted orders (checkmarks per player)
- "Waiting for opponent" / "Ready to resolve" indicators

**`MXEStatusBanner`** — conditional banner:
- If MXE keys not set: yellow warning "Encrypted actions unavailable — MXE cluster initializing"
- If ready: hidden or green "Connected to Arcium MXE"

---

## Phase 3: Integration & Polish

- Wire up real-time account subscriptions (match state auto-updates)
- Event toasts for MatchReady, TurnResolved, VisibilitySnapshotReady
- Error handling with user-friendly messages for all program error codes
- Loading states for MPC computations (can take 30-60s)
- Mobile-responsive layout
- Vercel deployment config

---

## Implementation Order

1. `sdk/constants.ts` + `sdk/types.ts` — foundation types and constants
2. `sdk/pda.ts` — PDA derivation (extracted from working test code)
3. `sdk/accounts.ts` — account resolution for each instruction
4. `sdk/crypto.ts` — encryption helpers
5. `sdk/client.ts` + `sdk/events.ts` — GameClient class
6. `sdk/index.ts` — barrel export
7. Next.js scaffold (`app/` with wallet provider, layout, config)
8. Lobby page with wallet connect + match list + create match
9. Match page with GameBoard + TurnStatus + BattleSummary
10. OrderPanel + order submission flow
11. Visibility request + grid overlay
12. MXE status banner + graceful degradation
13. Vercel deployment

Steps 1-6 (SDK) are independent of Next.js and can be tested in isolation.
Steps 7-13 (Frontend) build incrementally on the SDK.

---

## Dependencies to Add

**SDK (root package.json — already have most):**
- Already present: `@coral-xyz/anchor`, `@arcium-hq/client`, `@solana/web3.js`

**Frontend (`app/package.json`):**
- `next`, `react`, `react-dom`
- `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`
- `@coral-xyz/anchor`, `@solana/web3.js`
- `tailwindcss`, `postcss`, `autoprefixer`
- Link to `../sdk` for the game client SDK

## Notes

- The SDK will live at root level (`sdk/`) alongside `programs/` and `tests/`
- The Next.js app will live at `app/` alongside `sdk/`
- `tsconfig.json` at root stays for tests; `app/` and `sdk/` each get their own tsconfig
- IDL is referenced from `target/idl/` — shared between SDK and tests
