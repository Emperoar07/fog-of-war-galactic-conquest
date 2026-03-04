# Fog of War: Galactic Conquest

Fog of War: Galactic Conquest is an onchain strategy game built on Solana with private computation handled by [Arcium](https://www.arcium.com/).

It is a two-player prototype focused on one core idea: strategy games need hidden information to stay strategic. Player orders, fleet positions, and visibility are processed privately, while Solana settles the public game flow and publishes only the information that should be revealed.

The current devnet program is deployed at:

`BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE`

## Overview

Traditional onchain games expose all state publicly. That breaks simultaneous turns, scouting, and fog-of-war because every move can be inspected before resolution.

This project splits responsibilities:

- **Solana + Anchor** handle public orchestration: match creation, registration, turn coordination, settlement, and public summaries.
- **Arcium MXE** handles private computation: encrypted state, encrypted orders, private turn resolution, and per-player visibility.

The result is a verifiable game loop where hidden information remains hidden until the rules allow it to be revealed.

## Game Loop

1. Create a match.
2. Register both players.
3. Submit one encrypted order per player for the turn.
4. Resolve the turn privately.
5. Publish the public turn summary.
6. Request a player-scoped visibility report when needed.

The MVP uses:

- 2 players
- an 8x8 map
- 4 units per player
- deterministic combat
- private simultaneous turns

Current unit set:

- Fighter
- Scout
- Command

Current order types:

- Move
- Scout
- Attack

## What This Repository Includes

- `programs/`
  - The Anchor program that owns public state and queues Arcium computations.
- `encrypted-ixs/`
  - The Arcis circuits that define the private game logic.
- `sdk/`
  - A TypeScript client SDK for PDA derivation, account resolution, transaction building, and encryption helpers.
- `app/`
  - A Next.js frontend for wallet connection, match flow, and game interaction.
- `tests/`
  - Contract tests and lifecycle tests for the current MVP flow.
- `scripts/`
  - Operational scripts for devnet setup, circuit upload, and diagnostics.

## Current Status

This repository is a working prototype, not a finished game.

What is in place today:

- Devnet deployment for the game program
- Uploaded Arcium circuits and initialized computation definitions
- A browser client and TypeScript SDK
- Public match flow, account reads, and transaction assembly
- Lifecycle tests for both guard-rail behavior and positive encrypted flow

Known limitation:

- Full positive-path devnet execution currently depends on MXE cluster readiness on the target Arcium devnet cluster. If MXE keys are unavailable, encrypted actions cannot complete end-to-end.

## Local Development

### Prerequisites

- Node.js 20+
- Rust
- Solana CLI
- Anchor 0.32.x
- Arcium CLI

### Install

At the repository root:

```bash
npm install
```

For the frontend:

```bash
cd app
npm install
```

### Run the Frontend

```bash
cd app
npm run dev
```

### Build

Use a Solana wallet such as Phantom or Solflare when testing the frontend.

The Solana program should be built from a Linux environment (native Linux or WSL):

```bash
arcium build
```

### Test

The repository includes:

- source-level contract tests for structural guarantees
- lifecycle tests for end-to-end interaction against a configured network

Run the app lint pass:

```bash
npm --prefix app run lint
```

## SDK

The SDK is intended to be the main integration layer for external clients and the frontend.

It provides:

- PDA derivation helpers
- account-set builders for each instruction
- match account reads and parsing
- event subscriptions
- order encryption helpers
- a `GameClient` wrapper for high-level program interaction

## Privacy Model

Public:

- match metadata
- player registration
- turn number and match status
- public battle summary

Private:

- fleet positions
- unit state
- submitted orders
- visibility reports

## Technology

- Solana
- Anchor
- Arcium MXE / Arcis
- TypeScript
- Next.js
- React

## References

- [Arcium Documentation](https://docs.arcium.com/)
- [Arcium GitHub](https://github.com/arcium-hq)
- [Solana Documentation](https://solana.com/docs)
- [Anchor Documentation](https://www.anchor-lang.com/)
