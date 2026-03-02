# Fog of War: Galactic Conquest

## Project Positioning

**Project name:** Fog of War: Galactic Conquest

**Tagline:** The winner because it transforms Solana's transparent execution into a strategic advantage.

**Core pitch:** Fog of War: Galactic Conquest is a fully onchain 4X strategy game on Solana that uses Arcium to keep fleet positions, scouting, and turn orders encrypted until the game rules require revelation. This prevents map-sniffing bots and restores the hidden information needed for real strategy gameplay on a public blockchain.

## Problem

Traditional fully onchain games expose all state publicly. That breaks strategy, card, and social-deduction games because:

- Enemy positions can be read directly from onchain state.
- Hidden inventories or reinforcements are no longer hidden.
- Simultaneous moves can be front-run or countered before resolution.
- Bots can scrape the ledger and remove uncertainty from gameplay.

For a 4X game, this makes fog of war meaningless.

## Why Arcium

Arcium provides confidential computation for Solana applications. Instead of storing all game logic in transparent program state, the game can:

- accept encrypted player inputs,
- execute private game logic in Arcium's MXE,
- keep hidden state encrypted across turns, and
- reveal only the outputs required by the game rules.

This makes hidden scouting, ambushes, simultaneous actions, and uncertain battlefield intelligence viable onchain.

## High-Level Architecture

### Arcium MXE (Private Logic)

Arcium handles all secret state and confidential turn resolution.

Private encrypted state:

- unit `x` and `y` coordinates for every player
- `unit_type`
- `owner`
- `health`
- `vision_range`
- queued turn orders before resolution
- hidden sector ownership until discovered
- optional hidden resources or reinforcements

Private computations:

- `visibility_check`: compares scout and fleet distances to determine what each player can see
- `resolve_turn`: applies simultaneous movement, scouting, combat, and detection
- `combat_resolution`: decides battle outcomes without exposing unrevealed positions
- `player_reveal`: derives player-specific intelligence reports for only the correct player

Recommended privacy model:

- Use `Enc<Mxe, T>` for hidden shared game state that no player should be able to decrypt.
- Use `Enc<Shared, T>` only for player-specific private outputs that the player may later decrypt.

### Solana Anchor (Public State)

Anchor handles settlement, orchestration, and public records.

Public state:

- match account
- player registry
- turn counter
- public map grid / sector metadata
- revealed territory
- battle summaries that the rules allow to be public
- destroyed units once combat becomes visible
- final winner and match result

Anchor responsibilities:

- create and manage matches
- collect encrypted player actions
- invoke Arcium computations
- receive callback outputs
- write only valid public reveals back onchain

## Core Innovation

Fog of War: Galactic Conquest prevents "map-sniffing" bots from reading enemy movement out of contract state.

Instead of transparency destroying hidden information, the design uses:

- Solana for public, auditable settlement
- Arcium for private state transitions and confidential decision-making

This turns Solana's transparency into an advantage: final results are verifiable, while strategic information must be earned through gameplay rather than scraped from the ledger.

## MVP Scope

The MVP should prove that Arcium is essential to the game, not optional.

### 1. Match Setup

- Create a 2-player or 4-player match.
- Initialize a fixed-size map grid.
- Register players and assign encrypted spawn zones.

### 2. Private Unit Deployment

- Each player submits encrypted starting positions.
- Arcium validates placement rules without exposing coordinates publicly.

### 3. Turn Submission

Each turn, every player submits encrypted orders from a fixed command set:

- move
- scout
- attack
- defend
- colonize

### 4. Private Turn Resolution

Arcium resolves all player actions simultaneously:

- movement is processed privately
- hidden units stay hidden if not detected
- combat is resolved privately
- destroyed units are not revealed unless visibility rules permit it

### 5. Fog-of-War Visibility

Arcium runs a `visibility_check` using distance-based detection:

- scout units reveal nearby enemy fleets
- unseen enemy movement stays encrypted
- player A only learns what player A's units can legitimately observe

### 6. Public Results

Anchor writes back:

- public battle outcomes
- newly revealed sectors
- visible destroyed units
- updated turn number

It must not publish unrevealed enemy coordinates.

### 7. Win Condition

End the match when one player controls the required sectors or destroys the opposing command fleet.

Publicly reveal:

- winner
- final score
- optional full-map reveal at end of game

## Recommended Technical Boundaries

To keep the first build realistic, constrain the game:

- fixed map size such as `8x8` or `10x10`
- maximum `16` units per player
- fixed number of order slots per turn, such as `8`
- fixed-size data structures only

This matters because Arcium's Arcis environment is best suited to fixed-size arrays and structs, not dynamic collections like `Vec`, `String`, or `HashMap`.

## Build Plan

### Phase 1: Prototype the Privacy Loop

Goal: prove that hidden movement and selective reveal work.

Deliverables:

- match creation
- encrypted unit placement
- encrypted move submission
- one private `visibility_check`
- one callback that reveals only visible enemy units

### Phase 2: Add Combat

Goal: prove that hidden combat can be resolved fairly.

Deliverables:

- simultaneous move resolution
- attack range checks
- combat outcome generation
- battle summary callback

### Phase 3: Turn-Based Playable Demo

Goal: make the game demoable for judges.

Deliverables:

- repeated turn loop
- public map updates
- player-specific scouting results
- win condition

## Stretch Goals

If the MVP is stable, add:

- hidden resource harvesting
- planet capture and colony growth
- stealth units
- private reinforcements
- fog-preserving leaderboard or ranked matchmaking
- private random events using Arcium-compatible randomness patterns

## Required Submission Deliverables

To satisfy the stated requirements:

- a functional Solana project integrated with Arcium
- a clear explanation of how Arcium is used
- a clear explanation of the privacy benefit
- an open-source GitHub repository
- English documentation

Recommended repo contents:

- `README.md`
- architecture diagram
- setup instructions
- test instructions
- demo flow
- screenshots or short demo video link

## Judging Criteria Mapping

### Innovation

- Brings true fog-of-war to a fully onchain 4X strategy game.
- Shows a category of game that is normally broken on transparent chains.

### Technical Implementation

- Arcium is used for real hidden-state computation, not cosmetic privacy.
- Anchor cleanly manages public orchestration and settlement.
- Private and public state are separated intentionally.

### User Experience

- Players interact with meaningful uncertainty.
- The gameplay loop is understandable: scout, move, detect, attack, expand.
- The interface should clearly distinguish public map knowledge from private intel.

### Impact

- Demonstrates that Civilization-, StarCraft-, and Dark Forest-style mechanics can work on Solana.
- Opens a broader design space for hidden-information onchain games.

### Clarity

- The privacy model is easy to explain:
  Solana settles public outcomes, Arcium protects hidden strategy state.

## README Talking Points

Use these points in the submission README:

- Why fully public state breaks strategy games
- Which game data is public vs private
- Which instructions call Arcium
- What the `visibility_check` does
- How map-sniffing is prevented
- Why only rule-required reveals are written onchain
- Why this architecture is necessary for fair onchain 4X gameplay

## Current Arcium Implementation Constraints

Based on the current Arcium docs, account for these constraints:

- Arcium development currently targets macOS and Linux; on Windows, use WSL2.
- Current setup requires Rust, Solana CLI `2.3.0`, Anchor `0.32.1`, Yarn, Docker, and Docker Compose.
- New projects are created with `arcium init <project-name>`.
- Confidential logic lives in `encrypted-ixs/`.
- Build with `arcium build`.
- Test with `arcium test`.
- Callback output should stay compact because encrypted callback outputs are constrained by Solana transaction size.

## Best Official References

Use these official Arcium examples as implementation references:

- `rock_paper_scissors` for simultaneous secret moves
- `blackjack` for hidden persistent game state
- `coinflip` for private randomness patterns
- `voting` for selective reveal patterns

## Success Criteria

This project is submission-ready when all of the following are true:

- players can submit encrypted actions
- enemy fleets remain hidden until detected
- Arcium resolves visibility privately
- public state shows only valid reveals
- battle outcomes settle onchain
- the winner is announced publicly
- the repo can be cloned and run by judges

## Official Source Links

- Arcium docs: https://docs.arcium.com/
- Arcium website: https://www.arcium.com/
- Arcium GitHub: https://github.com/arcium-hq
- Developers overview: https://docs.arcium.com/developers
- Installation: https://docs.arcium.com/developers/installation
- Hello World: https://docs.arcium.com/developers/hello-world
- Encryption: https://docs.arcium.com/developers/encryption
- Computation lifecycle: https://docs.arcium.com/developers/computation-lifecycle
- Solana integration: https://docs.arcium.com/solana-integration-and-multichain-coordination/solana-integration-orchestration-and-execution
- Current limitations: https://docs.arcium.com/developers/limitations
- Arcium examples: https://github.com/arcium-hq/examples
- Ideas list: https://github.com/arcium-hq/ideas-list
- Request for Products: https://www.arcium.com/articles/request-for-products
