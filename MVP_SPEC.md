# Fog of War: Galactic Conquest MVP Spec

## Purpose

This document defines the minimum playable, technically coherent MVP for the current repository.

It is intentionally narrower than the long-form hackathon vision in `HACKATHON_SCOPE.md`.
The goal is to specify exactly what should exist before code changes continue, so privacy,
authorization, and turn semantics are consistent with the public project claims.

## Scope Boundary

The MVP must prove one thing clearly:

- hidden unit movement and selective information reveal work on Solana only because Arcium is used

The MVP does not need to be a full 4X game. It only needs a stable, demoable turn loop that
supports hidden state, scouting, combat, and a public winner.

## Core Demo Story

Two players join a match.

Each player controls a small fleet with hidden positions.

Both players submit encrypted orders for the same turn.

Arcium resolves movement and combat privately.

Each player can only access a visibility report derived from their own units.

Anchor publishes only the rule-allowed public result:

- current turn
- visible battle outcome summary
- revealed sectors, if any
- final winner when the command fleet win condition is met

## Hard Technical Constraints

These constraints are part of the MVP, not implementation details:

- fixed map size: `8x8`
- supported players in MVP: `2`
- maximum supported players in state layout: `4`
- units per player: `4`
- fixed-size arrays only
- no dynamic collections (`Vec`, `String`, `HashMap`)
- encrypted callback outputs must stay compact

The current constants in the repository already align with this shape and should remain stable
unless there is a measured reason to change the account layout.

## Public vs Private State

### Public State (Anchor)

Public state exists in the `GalaxyMatch` account and may be readable by anyone.

The MVP public state should contain:

- `match_id`
- `authority`
- registered player pubkeys
- player count
- public turn number
- match status
- deterministic map seed
- revealed sector ownership or discovery markers
- last public battle summary
- optional per-player visibility metadata handles, but not decrypted intel
- encrypted hidden-state blob
- encrypted order queue blob
- encrypted visibility blob(s)
- nonces for each encrypted blob

Public state must never contain:

- hidden unit coordinates before legal reveal
- hidden queued orders before resolution
- hidden health values except where combat results are explicitly public

### Private State (Arcium)

Private state lives in encrypted Arcis structures.

The MVP private state should contain:

- each unit's `x` coordinate
- each unit's `y` coordinate
- each unit's `unit_type`
- each unit's `health`
- each unit's `vision_range`
- each unit's alive/dead status
- private turn counter
- pending order slots for the active turn

## Match Lifecycle

### 1. Create Match

The match authority creates a match.

Required behavior:

- allocate the `GalaxyMatch` PDA
- store public metadata
- queue `init_match`
- initialize encrypted hidden state with deterministic spawn zones
- set match status to `WaitingForPlayers`

Public status values should be treated as:

- `0`: waiting for players
- `1`: active
- `2`: completed

### 2. Register Players

Players occupy fixed slots.

Required rules:

- only unfilled slots may be claimed
- no duplicate registration
- registrations must stop once `player_count` is reached
- for the MVP, `player_count` should be set to `2`
- the match moves to `Active` only when exactly `player_count` players are registered

### 3. Submit Orders

Players submit encrypted orders for the current turn.

Required rules:

- only registered players may submit
- a player may only submit orders for their own slot
- orders must be written into a fixed-size encrypted order queue
- submission must not directly mutate unit positions or combat outcomes
- each player may submit once per turn
- duplicate submission for the same turn must be rejected or explicitly replace the prior submission

For the MVP, each player submits exactly one order per turn.
This keeps the first playable loop small and avoids overcomplicating state shape.

### 4. Resolve Turn

Turn resolution is the privacy-critical step.

Required rules:

- resolution must happen only after all active players have submitted for the current turn
- resolution must consume the queued encrypted orders
- movement and combat are applied inside Arcium, not in public state
- the encrypted hidden state must be updated to the next turn state
- the private turn counter must advance
- the public turn counter must match the resolved private turn
- the encrypted order queue must be cleared for the next turn

This is the core correction to the current scaffold: `resolve_turn` must update hidden state,
not only emit a public summary.

### 5. Visibility Check

Visibility is player-specific.

Required rules:

- only a registered player may request visibility
- the caller's wallet must map to exactly one player slot
- the requested viewer index must match that caller's slot
- the visibility report must be derived only from that player's living units
- enemy units outside legal sight range remain hidden

The visibility result may be stored onchain as encrypted shared output, but it must be scoped
so one player cannot ask for another player's report.

### 6. End Match

The match ends when exactly one player's command fleet remains alive.

Required behavior:

- set status to `Completed`
- publish winner index
- publish final battle summary
- optional full reveal is out of scope for the MVP

## Order Model

For the MVP, each player gets one order slot per turn.

Order fields:

- `player_index`
- `unit_slot`
- `action`
- `target_x`
- `target_y`

Supported actions in the MVP:

- `move`
- `scout`
- `attack`

Deferred actions:

- `defend`
- `colonize`

These deferred actions should either remain unimplemented and removed from the external interface,
or remain explicitly disabled until phase two of development.
They should not be advertised as active gameplay if they are still no-op operations.

## Turn Semantics

The MVP must model turns as simultaneous from the player's perspective.

That means:

- all players submit without learning the current turn's enemy order
- no order is applied immediately at submission time
- all accepted orders are resolved together inside `resolve_turn`

A valid MVP resolution sequence is:

1. Read encrypted state.
2. Read encrypted order queue.
3. Apply all movement/scout relocations.
4. Apply all attack checks against the moved state.
5. Compute destroyed units.
6. Compute visibility outputs.
7. Return updated encrypted state.
8. Return compact public summary.

This is enough to support the "hidden simultaneous move" claim.

## Combat Rules

The MVP combat model should stay simple and deterministic:

- attacks target a tile
- all enemy units on that tile take one damage
- units at zero health are destroyed
- destroyed units are marked dead and moved to `EMPTY_COORD`
- command fleet is unit slot `0`

No randomness is required for the MVP.

## Visibility Rules

The MVP should use Manhattan distance for detection:

- a viewer sees an enemy unit if any of the viewer's living units satisfy
  `abs(dx) + abs(dy) <= vision_range`

Visibility reports should include:

- presence flag per enemy unit slot
- revealed `x`
- revealed `y`

Visibility reports should not include:

- hidden health
- queued enemy orders
- positions for unseen enemy units

## Public Battle Summary

The public battle summary should remain compact.

Minimum public summary:

- `winner`
- destroyed unit count per player
- command fleet alive flag per player
- next turn number

The current `battle_summary` shape is acceptable for the MVP if the encoding remains stable and
documented.

## Authorization Rules

The MVP needs explicit authorization guarantees.

Required rules:

- only the match authority may create the match
- only unregistered wallets may claim a player slot
- only registered players may submit orders
- a player may only submit as their own slot
- only the match authority or a registered player may trigger turn resolution
- visibility checks must be bound to the caller's actual player slot

If any of these rules are missing, the privacy claims are materially weaker than the design.

## Events

The existing event pattern is sufficient if retained:

- `MatchReady`
- `VisibilitySnapshotReady`
- `TurnResolved`

If visibility becomes per-player scoped, the visibility event should include the viewer slot or a
player-specific handle so the client can associate the callback with the correct recipient.

## Required Tests

The placeholder constant test is not sufficient.

The MVP should have at least these tests:

1. Match creation initializes encrypted state and the match account correctly.
2. Registration rejects duplicate players, occupied slots, and over-registration.
3. Order submission rejects unregistered callers and mismatched player indexes.
4. Turn resolution fails until all required players have submitted.
5. Turn resolution advances both public and private turn state.
6. Visibility requests are restricted to the caller's own slot.
7. Winner is emitted when only one command fleet remains.

## Non-Goals For This MVP

The following are explicitly out of scope:

- UI polish
- full 4-player balancing
- resource economy
- sector colonization logic
- stealth mechanics
- randomness
- ranking or matchmaking
- full post-game replay or total map reveal

## Recommended Implementation Order

Implement in this order:

1. Fix authorization constraints in the current Anchor program.
2. Add an encrypted pending-order queue to the private state model.
3. Refactor `submit_orders` to write queued orders instead of mutating unit state.
4. Refactor `resolve_turn` to output updated hidden state plus compact public summary.
5. Bind visibility to the caller's actual player slot.
6. Replace the placeholder test with lifecycle tests.

This order minimizes risk because it hardens trust boundaries before adding more gameplay logic.

## Definition Of Done

The MVP is complete when all of the following are true:

- two players can create and join a match
- both can submit encrypted orders for the same turn
- enemy movement remains hidden before turn resolution
- turn resolution updates encrypted state privately
- each player can obtain only their own legal visibility report
- public state exposes only the allowed battle summary
- a winner is publicly declared when one command fleet remains
- the behavior is covered by automated tests
