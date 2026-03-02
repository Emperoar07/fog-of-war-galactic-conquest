# Fog of War: Galactic Conquest

Fog of War: Galactic Conquest is a fully onchain 4X strategy game on Solana that uses Arcium to keep fleet positions, scouting, and turn orders encrypted until the game rules require revelation.

This repository is an Arcium-style project scaffold for the hackathon MVP. It includes:

- an Anchor program with Arcium computation hooks
- an `encrypted-ixs/` Arcis crate for hidden-state logic
- a test scaffold
- a submission-ready architecture and scope document

## Why This Project Exists

Traditional onchain game state is fully public. That breaks strategy games because opponents and bots can inspect:

- hidden fleet positions
- simultaneous moves before they resolve
- fog-of-war information that should be secret

Fog of War: Galactic Conquest fixes that by splitting responsibilities:

- **Arcium MXE:** private state and confidential game logic
- **Solana + Anchor:** public orchestration, settlement, and rule-required reveals

The result is a fully onchain strategy game where Solana's transparent settlement remains verifiable, but hidden information is still genuinely hidden.

## Arcium Integration

The current scaffold wires four Arcium computation definitions:

1. `init_match`
2. `submit_orders`
3. `visibility_check`
4. `resolve_turn`

### Private Logic (`encrypted-ixs/`)

The confidential Arcis module stores and computes:

- hidden `x` and `y` coordinates for all units
- hidden `unit_type`
- hidden `health`
- hidden `vision_range`
- hidden alive/dead unit status

Private instructions:

- `init_match`: initializes encrypted spawn locations
- `submit_orders`: updates encrypted positions and attack outcomes
- `visibility_check`: computes what a player is allowed to see
- `resolve_turn`: produces the public battle summary and winner state

### Public Logic (`programs/fog_of_war_galactic_conquest`)

The Anchor program:

- creates matches
- registers players
- queues Arcium computations
- stores encrypted blobs returned by callbacks
- stores public battle summaries
- emits public events when turns resolve

## Privacy Benefits

This design prevents "map-sniffing" bots from scraping enemy movements out of contract state.

Without Arcium:

- fleet positions would be visible onchain
- scouting would be meaningless
- simultaneous actions would leak before resolution

With Arcium:

- only battle summaries and rule-valid reveals are public
- hidden positions remain encrypted between turns
- players only learn what their scouts can legitimately observe

## Repository Layout

- [HACKATHON_SCOPE.md](./HACKATHON_SCOPE.md): submission scope, judging alignment, and deliverables
- [README.md](./README.md): overview and setup guidance
- [Anchor.toml](./Anchor.toml): Anchor workspace config
- [Arcium.toml](./Arcium.toml): Arcium localnet config
- [programs/fog_of_war_galactic_conquest/src/lib.rs](./programs/fog_of_war_galactic_conquest/src/lib.rs): public Anchor program
- [encrypted-ixs/src/lib.rs](./encrypted-ixs/src/lib.rs): private Arcis instructions
- [tests/fog_of_war_galactic_conquest.ts](./tests/fog_of_war_galactic_conquest.ts): test scaffold

## Current Status

This workspace was scaffolded on March 2, 2026.

The code is structured against the current public Arcium docs and example layout, but it has **not** been compiled in this environment because:

- the `arcium` CLI is not installed locally
- `yarn` is not installed locally
- the required Solana + Arcium localnet stack is not fully present in WSL yet

That means this repo is a strong implementation scaffold, not a verified build artifact yet.

## Local Setup

Arcium's current docs target macOS and Linux. On Windows, use WSL2.

### Required Tooling

- Rust
- Solana CLI `2.3.0`
- Anchor `0.32.1`
- Yarn
- Docker
- Docker Compose
- Arcium CLI

### Install Arcium CLI

The current Arcium docs show:

```bash
cargo install --locked arcium-cli
```

### Project Commands

```bash
arcium build
arcium test
```

If `arcium` is not available yet, complete the WSL toolchain setup first.

## MVP Gameplay Flow

1. Create a match with encrypted initial state.
2. Register players publicly.
3. Each player submits encrypted orders.
4. Arcium updates hidden state privately.
5. Arcium computes visibility privately.
6. Anchor publishes only valid public battle results.
7. The winner is revealed publicly when the command fleet condition is met.

## What Judges Should Notice

### Innovation

This project makes true fog-of-war 4X gameplay possible on Solana.

### Technical Implementation

Arcium is used for real hidden-state computation, not cosmetic privacy.

### User Experience

Players interact with meaningful uncertainty instead of leaked contract state.

### Impact

This opens the door for Civilization-, StarCraft-, and Dark Forest-style gameplay onchain.

### Clarity

The privacy model is easy to explain:

- Solana settles public outcomes.
- Arcium protects hidden strategy state.

## Next Build Steps

1. Install the full Arcium toolchain in WSL2.
2. Run `arcium build` and fix any type mismatches from the initial scaffold.
3. Add a real client flow with `@arcium-hq/client` for encrypting player orders.
4. Expand the UI to render private intel overlays versus public map data.

## Official References

- Arcium docs: https://docs.arcium.com/
- Arcium website: https://www.arcium.com/
- Arcium GitHub: https://github.com/arcium-hq
- Arcium examples: https://github.com/arcium-hq/examples
