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

## How To Play

Use the app in one of three ways:

- **Demo mode**
  - Full UI loop with simulated game state.
  - Best for learning the controls and the match flow without depending on MXE readiness.
- **Quick Match vs AI**
  - Full local skirmish against a built-in computer opponent.
  - Lets you choose `Easy`, `Medium`, or `Hard` so the AI pressure matches the mode you picked.
- **Live devnet mode**
  - Connects to the deployed Solana program on devnet.
  - Public flows work normally. Full encrypted gameplay still depends on Arcium MXE readiness.

The in-app **How To Play** guide is the detailed walkthrough and is kept closest to the live UI.

### Fastest Path: Demo Mode

1. Open the frontend.
2. Click **Launch Demo**.
3. Select a sector on the board.
4. Use **Fire Control** to review and confirm an order, then resolve the turn.
5. Use the **Enemy Signals** panel whenever you want a visibility report.
6. Turn **Companion Mode** on if you want a local tactical suggestion before you commit.
7. Use the **Audio** toggle if you want ambient sound plus action cues.
8. Watch the **Turn Timeline** panel to review how the map has shifted during the current session.

Demo mode does not require a wallet and does not depend on live MXE encryption.

### Solo Practice: Quick Match vs AI

1. Open the frontend.
2. Choose **Quick Match Easy**, **Quick Match Medium**, or **Quick Match Hard**.
3. Select a sector on the board.
4. Use **Fire Control** to review and confirm an order.
5. Wait for the AI to lock in its response, then resolve the turn.
6. Use the **Enemy Signals** panel whenever you want a local intel refresh.
7. Turn **Companion Mode** on if you want an advisory suggestion before you commit.
8. Easy gives you the most reaction time, Medium is balanced, and Hard locks faster with stronger counter-pressure.

Quick Match is local and instant, so it is useful for solo practice when you want a more active opponent than demo mode.

### Live Devnet

1. Open the frontend and connect a Solana wallet such as Phantom or Solflare.
2. Browse existing matches in the lobby, or create a new one.
3. Join a match if a player slot is open, then use **Fire Control** for reviewed order submission and turn resolution.
4. Submit one encrypted order per turn.
5. Resolve the turn after all players have submitted.
6. Use the **Enemy Signals** panel when you need visibility.
7. Turn **Companion Mode** on if you want a local tactical suggestion with anti-repeat memory.
8. If you are only watching, observer mode still shows public state and the live session timeline.

Important:

- If the Arcium devnet MXE cluster is not ready, encrypted actions may be unavailable or may not finalize.
- In that case, use demo mode for a full walkthrough and use live devnet mainly for public-state testing.

### Run It Locally

1. Install dependencies:
   - `npm install`
   - `cd app && npm install`
2. Start the frontend:
   - `cd app`
   - `npm run dev`
3. Open the local app in your browser.
4. Use:
   - the demo path for a guaranteed playable UI loop
   - wallet-connected devnet mode for live network interaction

### Color Guide

- **Green**: your controlled sectors and friendly presence
- **Amber**: enemy controlled sectors or enemy pressure
- **Cyan**: contested sectors, visibility intel, and shared tactical updates
- **Red**: danger, damage, failed actions, or destroyed battle zones
- **Dim green**: idle, waiting, hidden, or inactive interface states

### Unit And Action Guide

- **Command Fleet**
  - Your anchor unit.
  - Best used to hold safe sectors and stabilize your side of the map.
  - Only move it when your side is under pressure or the center is already secure.
- **Scout Wing**
  - Your information unit.
  - Best used when enemy positions are unclear, when the center is contested, or before you commit a fighter.
- **Fighter Wings**
  - Your pressure units.
  - Best used to attack confirmed threats, push into neutral sectors, and hold lanes after scouting.
- **Move**
  - Reposition into safer or more useful sectors.
  - Use it for spacing, board control, or to protect the command fleet.
- **Scout**
  - Spend the turn gathering information.
  - Use it when visibility is weak or when you need to test a risky lane first.
- **Attack**
  - Commit force to a hostile sector.
  - Use it after visibility confirms a likely target or when enemy pressure is building.

### When To Switch

- Start with the **Scout Wing** when you do not have enough information.
- Switch to a **Fighter Wing** after a target is confirmed or when you need to pressure the map.
- Fall back to the **Command Fleet** only when your side needs to stabilize or retreat.
- If the board changes quickly, scout again before repeating the same attack lane.

### What "Playing" Means Right Now

Today, the most reliable fully playable experience is still demo mode.

The live onchain experience is real, but the full encrypted turn loop still depends on Arcium devnet cluster readiness. When MXE is not available, demo mode remains the best way to test and showcase the project.

The MVP uses:

- 2 players
- a 7x7 map
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
