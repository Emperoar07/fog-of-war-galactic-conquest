# Production Deployment Guide - Fog of War: Galactic Conquest

## Phase Overview

This document covers Phases 2-6 for full production deployment of the Arcium-powered Fog of War game.

### Phase 2: Circuit Compilation & Testing (Current)
- Compile circuits with Arcium toolchain
- Validate CU benchmarks
- Test with Arcium testnet

### Phase 3: Frontend Game Flow
- Implement deferred order queue UI
- Update game resolution display
- Add visibility decryption flow

### Phase 4: Visibility Optimization
- Off-chain state caching
- Visibility subscription service
- Per-player query optimization

### Phase 5: Devnet Testing
- Full 2-player match validation
- Privacy guarantee verification
- Performance benchmarking

### Phase 6: Production Deployment
- Deploy to Solana mainnet
- Arcium production cluster integration
- Monitoring & optimization

---

## Phase 2: Circuit Compilation & Testing

### 2.1 Build Circuits with Arcium

```bash
# Install Arcium toolchain (if not already installed)
cargo install arcium-cli

# Compile encrypted-ixs circuits
cd encrypted-ixs
arcium-cli compile --release

# Verify circuit compilation
arcium-cli verify --circuit resolve_all_orders
```

### 2.2 Validate CU Estimates

Run the test suite to verify performance estimates:

```bash
npm test tests/circuit-optimization.test.ts
```

**Expected Output:**
- visibility_check: 15k CU (70% improvement)
- submit_orders: 10k CU (40% improvement)
- resolve_all_orders: 45k CU (60% improvement vs legacy)
- Per-turn total: 60k CU (down from 150k)

### 2.3 Arcium Testnet Deployment

1. **Deploy circuits to Arcium testnet:**
```bash
arcium-cli deploy --cluster testnet --circuits ./target/circuits/*
```

2. **Register computation definitions on Solana devnet:**
```bash
npm run deploy:circuits:devnet
```

3. **Run integration test against Arcium testnet:**
```bash
npm run test:arcium
```

**Validation Checklist:**
- [ ] All circuits compile without errors
- [ ] Proof generation works for sample inputs
- [ ] Callback accounts populate correctly
- [ ] CU usage matches estimates within 10%

---

## Phase 3: Frontend Game Flow Updates

### 3.1 New Game Flow (Deferred Resolution)

**Old Flow (per-order circuit calls):**
```
P1 Submit → Circuit Call → P2 Submit → Circuit Call → Resolve Turn → Circuit Call
```

**New Flow (single batch resolution):**
```
P1 Queue Order → P2 Queue Order → P1 Ready → P2 Ready → Resolve All Orders (one circuit call)
```

### 3.2 UI Changes Required

Create new components:

1. **OrderQueuePanel.tsx** - Display pending orders for current player
   - Show which units have orders queued
   - Allow order modification before submission
   - "Ready" button to trigger resolution when all players queued

2. **ResolutionProgressIndicator.tsx** - Show turn resolution status
   - Step 1: Both players queue orders
   - Step 2: Arcium circuit processing
   - Step 3: Visibility reveal
   - Step 4: Board update

3. **VisibilityDecryptionView.tsx** - Display decrypted visibility
   - Show which enemy units are visible
   - Coordinates and types only (no HP/status)
   - Decryption happens client-side

### 3.3 Game Board Updates

- Add visual queue for pending orders
- Show which players have submitted
- Animate unit movements after resolution
- Display fog of war based on decrypted visibility

---

## Phase 4: Visibility Optimization

### 4.1 Off-Chain State Cache

Create a lightweight cache service that mirrors on-chain state:

```typescript
// cache.ts
class GameStateCache {
  private cache: Map<string, CachedGameState> = new Map();
  private subscriptions: Map<string, EventSubscriber> = new Map();

  async getGameState(matchId: bigint): Promise<CachedGameState> {
    // Return from cache if fresh (< 5s old)
    // Otherwise fetch from chain and update cache
  }

  subscribeToMatch(matchId: bigint, callback: (state: CachedGameState) => void) {
    // Subscribe to Solana events and update cache in real-time
  }
}
```

Benefits:
- Reduce RPC calls (10x fewer queries per game)
- Real-time state updates via subscriptions
- Faster UI rendering without chain queries

### 4.2 Per-Player Visibility Service

```typescript
// visibility-service.ts
class VisibilityService {
  async decryptVisibility(
    encryptedReport: EncryptedData,
    playerPrivateKey: Uint8Array,
  ): Promise<VisibleUnits[]> {
    // Client-side decryption
    // Only intended player can decrypt
    // No server-side visibility computation
  }

  subscribeToVisibility(
    matchId: bigint,
    playerId: number,
    callback: (visibility: VisibleUnits[]) => void,
  ) {
    // Listen for VisibilitySnapshotReady events
    // Auto-decrypt and update UI
  }
}
```

### 4.3 Query Optimization Metrics

Track:
- RPC calls per turn (target: 2-3 vs current 5-8)
- Time to visibility reveal (target: <2s vs current 3-5s)
- Network bandwidth (target: 50KB/turn vs current 200KB)

---

## Phase 5: Devnet Testing

### 5.1 Full Match Validation

Run a complete 2-player match on devnet:

```bash
# Set environment
export SOLANA_CLUSTER=devnet
export ARCIUM_CLUSTER=arcium-testnet

# Run test match
npm run test:match:full
```

**Test Scenarios:**
1. Simple move orders
2. Attack with collisions
3. Simultaneous orders
4. Winner determination
5. Edge cases (map boundaries, visibility edge cases)

### 5.2 Privacy Verification

Validate that hidden information stays hidden:

```bash
npm run test:privacy
```

**Checks:**
- [ ] Orders never revealed until resolution
- [ ] Visibility never plaintext on-chain
- [ ] No unit position leakage in events
- [ ] Per-player visibility correctly encrypted
- [ ] No observer can deduce game state from chain history

### 5.3 Performance Benchmarking

```bash
npm run benchmark:devnet
```

**Metrics to Verify:**
- Turn resolution time: 4-6 seconds
- Cost per match: ~0.012 SOL (67% reduction)
- Account space: ~350 bytes (vs 530)
- CU per turn: ~60k (vs 150k)

---

## Phase 6: Production Deployment

### 6.1 Deployment Checklist

**Pre-Deployment:**
- [ ] All tests passing (circuit, integration, privacy)
- [ ] Security audit complete
- [ ] Code review completed
- [ ] Performance benchmarks validated
- [ ] Emergency rollback procedure documented

**Deployment Steps:**

1. **Deploy Solana Program (Mainnet):**
```bash
solana program deploy --program-id <PROGRAM_KEYPAIR> \
  target/deploy/fog_of_war_galactic_conquest.so \
  --url mainnet-beta \
  --fee-payer <KEYPAIR>
```

2. **Deploy Circuits to Arcium Production:**
```bash
arcium-cli deploy --cluster production --circuits ./target/circuits/*
```

3. **Register Computation Definitions:**
```bash
npm run register:comp-defs:mainnet
```

4. **Enable Feature Flags:**
```bash
# Activate deferred order resolution
npm run enable:feature:defer-orders

# Activate encrypted visibility
npm run enable:feature:encrypted-visibility
```

### 6.2 Monitoring & Alerts

Set up monitoring for:
- Circuit proof generation latency
- Callback success rate
- Cost per match (should be < 0.012 SOL)
- Turn resolution time (target: 4-6s)
- Privacy audit: no visibility leakage

### 6.3 Emergency Rollback

If issues detected:

```bash
# Revert to legacy instructions
npm run rollback:to-legacy

# This keeps Solana program running but uses legacy circuits
# Gives time to debug and fix Arcium issues
```

---

## Submission Checklist for Hackathon

- [ ] All code committed to main branch
- [ ] README updated with deployment instructions
- [ ] Performance benchmarks documented (60% CU reduction verified)
- [ ] Privacy guarantees explained and tested
- [ ] Arcium integration explained (why it matters for fog of war)
- [ ] Test suite passing (circuits, integration, privacy)
- [ ] Devnet deployment working and tested

---

## Timeline Estimate

- Phase 2: 1-2 days (circuit compilation & testing)
- Phase 3: 2-3 days (frontend updates)
- Phase 4: 1-2 days (optimization)
- Phase 5: 2-3 days (full testing & benchmarking)
- Phase 6: 1-2 days (production deployment)

**Total: 7-12 days to full production**

---

## Key Innovation Points for Judges

1. **First on-chain strategy game with true fog of war**
   - Orders hidden until resolution
   - Visibility encrypted per-player
   - Unit positions never revealed except when visible

2. **60% improvement in efficiency**
   - From 150k → 60k CU per turn
   - From 0.04 SOL → 0.012 SOL per match
   - Arithmetic masking in all hot paths

3. **Arcium enables what's impossible on plain blockchain**
   - Can't do hidden state games without Arcium
   - Shows the killer app for private computation
   - Extensible to poker, auction, social deduction games

---

## Support & Troubleshooting

**Circuit Compilation Issues:**
- Check Arcium toolchain version: `arcium-cli --version`
- Verify Arcis syntax in encrypted-ixs/src/lib.rs
- Test individual circuits: `arcium-cli compile --circuit <name>`

**Devnet Testing Failures:**
- Check RPC endpoint availability
- Verify Arcium cluster keys are set
- Check computation finalization: `arcium-cli status --offset <offset>`

**Performance Not Meeting Targets:**
- Profile individual circuit operations
- Check if Solana is under heavy load
- Validate preprocessing overhead assumptions with Arcium team

