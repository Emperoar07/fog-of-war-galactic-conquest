# Fog of War: Galactic Conquest

A fully on-chain encrypted strategy game on Solana, powered by [Arcium](https://www.arcium.com/) for private multi-party computation. Two players command hidden fleets across an 8x8 galactic grid, submitting encrypted orders simultaneously each turn. Fleet positions, scouting data, and combat outcomes remain hidden until the game rules require revelation.

**Live on Solana Devnet** | Program: `BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE`

## How It Works

Traditional on-chain games expose all state publicly. This breaks strategy games because opponents (and bots) can inspect hidden fleet positions, read simultaneous moves before resolution, and bypass fog-of-war entirely.

Fog of War: Galactic Conquest solves this by splitting responsibilities:

- **Solana + Anchor** handles public orchestration: match creation, player registration, turn coordination, settlement, and rule-required reveals.
- **Arcium MXE** handles private computation: encrypted fleet positions, hidden combat resolution, and per-player visibility scoping.

The result is a verifiably fair strategy game where hidden information stays genuinely hidden.

## Gameplay

1. **Create a match** — The match authority initializes a game with encrypted starting positions.
2. **Register players** — Two players join the match by claiming open slots.
3. **Submit orders** — Each player submits one encrypted order per turn (move, scout, or attack a tile). Orders are encrypted client-side using x25519 key exchange with the MXE cluster.
4. **Resolve turn** — Once both players submit, anyone can trigger turn resolution. Arcium applies all movement and combat privately, then returns only the allowed public summary.
5. **Check visibility** — Players can request a visibility report scoped to their own units. Enemy positions outside detection range remain hidden.
6. **Win condition** — The match ends when one player's command fleet is destroyed. The winner is publicly declared on-chain.

### Game Constants

| Parameter | Value |
|-----------|-------|
| Grid size | 8 x 8 |
| Players | 2 (MVP) |
| Units per player | 4 (Command, Scout, Frigate, Destroyer) |
| Actions | Move, Scout, Attack |
| Combat | Deterministic, no randomness |
| Visibility | Manhattan distance from living units |

## Project Structure

```
.
├── programs/                    # Solana Anchor program
│   └── fog_of_war_galactic_conquest/
│       └── src/lib.rs           # On-chain program logic
├── encrypted-ixs/               # Arcium Arcis circuits (private computation)
│   └── src/lib.rs               # init_match, submit_orders, visibility_check, resolve_turn
├── sdk/                         # TypeScript game client SDK
│   ├── client.ts                # GameClient class — high-level API
│   ├── crypto.ts                # x25519 key exchange, RescueCipher encryption
│   ├── pda.ts                   # PDA derivation helpers
│   ├── accounts.ts              # Account resolution for each instruction
│   ├── constants.ts             # Program ID, game constants, enums
│   ├── types.ts                 # TypeScript types for on-chain state
│   └── index.ts                 # Barrel export
├── app/                         # Next.js frontend (deployable to Vercel)
│   └── src/
│       ├── app/                 # Pages (lobby, match view)
│       ├── components/          # UI components (game board, order panel, etc.)
│       └── hooks/               # React hooks (useGameClient, useMatch)
├── tests/
│   ├── lifecycle.ts             # Full devnet lifecycle test suite
│   └── fog_of_war_galactic_conquest.ts  # Source-level contract tests
├── scripts/                     # Utility scripts (circuit upload, diagnostics)
├── MVP_SPEC.md                  # Detailed MVP specification
└── DEV_NOTES.md                 # Implementation log
```

## Getting Started

### Prerequisites

- Node.js 20+
- Rust toolchain
- Solana CLI 2.3.0+
- Anchor 0.32.1
- Arcium CLI (`cargo install --locked arcium-cli`)

### Install Dependencies

```bash
npm install
cd app && npm install
```

### Run the Frontend

```bash
cd app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect a Solana wallet (Phantom, Solflare).

### Run Tests

The lifecycle tests run against Solana devnet:

```bash
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"
export ARCIUM_CLUSTER_OFFSET=456
export RUN_ARCIUM_LOCALNET=1

npx ts-mocha -p ./tsconfig.json -t 600000 tests/lifecycle.ts
```

### Build the Solana Program

```bash
# In WSL (required for Solana SBF compilation)
arcium build
```

### Deploy to Devnet

```bash
solana program deploy target/deploy/fog_of_war_galactic_conquest.so \
  --program-id BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE \
  -u devnet
```

## SDK Usage

The SDK provides a clean TypeScript API for interacting with the game program:

```typescript
import { GameClient, OrderAction } from "./sdk";

// Initialize
const client = new GameClient(provider, clusterOffset);

// Check MXE readiness
const status = await client.isReady();

// Create a match
const { matchPDA, matchId } = await client.createMatch(BigInt(1), 2, BigInt(42));

// Register a player
await client.registerPlayer(matchPDA, 1);

// Submit encrypted orders
await client.submitOrders(matchPDA, 0, {
  unitSlot: 0,
  action: OrderAction.Move,
  targetX: 3,
  targetY: 4,
}, playerPrivateKey);

// Resolve the turn
await client.resolveTurn(matchPDA);

// Read match state
const match = await client.fetchMatch(matchPDA);
const summary = client.parseBattleSummary(match);
```

## Architecture

### Privacy Model

| Data | Visibility |
|------|-----------|
| Match metadata (ID, players, turn, status) | Public |
| Battle summary (winner, destroyed counts) | Public |
| Fleet positions (x, y for each unit) | Encrypted (Arcium) |
| Unit health and alive status | Encrypted (Arcium) |
| Submitted orders | Encrypted (Arcium) |
| Visibility reports | Encrypted, scoped per player |

### Arcium Circuits

Four circuits handle all private computation:

- **`init_match`** — Generates encrypted initial fleet positions from a deterministic seed.
- **`submit_orders`** — Validates and queues one encrypted order per player per turn.
- **`resolve_turn`** — Applies all movement, resolves attacks, checks win condition, advances turn.
- **`visibility_check`** — Computes what a specific player can see based on their living units' vision ranges.

### On-Chain Events

- `MatchReady` — Emitted after `init_match` callback. Match is open for registration.
- `TurnResolved` — Emitted after `resolve_turn` callback. Includes winner and next turn number.
- `VisibilitySnapshotReady` — Emitted after `visibility_check` callback. Scoped to the requesting player.

## Current Status

- Program deployed to Solana devnet
- All 4 Arcium circuits uploaded and finalized
- All 4 computation definitions initialized on-chain
- Game client SDK complete
- Next.js frontend with wallet integration complete
- 6/11 lifecycle tests passing (all authorization and guard tests)
- 5 tests pending: awaiting MXE cluster key exchange completion on devnet

## Tech Stack

- **Blockchain**: Solana (Anchor 0.32.1)
- **Privacy**: Arcium MXE (multi-party computation)
- **Frontend**: Next.js 16, React, Tailwind CSS
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare)
- **Language**: Rust (on-chain), TypeScript (SDK + frontend)

## References

- [Arcium Documentation](https://docs.arcium.com/)
- [Arcium GitHub](https://github.com/arcium-hq)
- [Solana Documentation](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
