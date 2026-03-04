# Dev Notes

This file is the running implementation log for the repository.

Use it to capture:

- what changed
- why it changed
- known risks or follow-up work

## 2026-03-02

### Added MVP spec

- Created `MVP_SPEC.md` as the concrete implementation contract for the first playable demo.
- The spec narrows the project to a two-player MVP with fixed-size encrypted state and explicit
  public/private boundaries.
- It defines the intended match lifecycle, order model, turn semantics, combat rules, visibility
  rules, authorization requirements, and required tests.

### Key design correction captured

- The current scaffold applies order effects too early.
- The spec now requires `submit_orders` to queue encrypted orders and `resolve_turn` to consume
  them and update hidden state.

### Standing workflow

- Future repository changes should append a short dated note here.

### Hardened MVP scaffold

- Updated the Anchor program to enforce the two-player MVP at match creation.
- Added registration guards so extra players cannot join after the match is full or active.
- Added caller-to-slot checks for order submission and removed the externally supplied
  `viewer_index` from the public visibility instruction.
- Added public `submitted_orders` tracking so turn resolution now requires all players to submit.
- Updated turn resolution to refresh the encrypted hidden state in the callback before publishing
  the public battle summary.

### Encrypted turn model refactor

- Replaced immediate order application with a pending-order queue inside the encrypted `GalaxyState`.
- `submit_orders` now queues one validated order per player per turn.
- `resolve_turn` now applies queued movement first, then queued attacks, clears the queue, and
  advances the private turn counter.

### Tests replaced

- Replaced the placeholder constant test with source-level contract tests that verify:
  MVP player-count enforcement, authorization checks, queued-order state, and the presence of the
  spec and dev-log files.

### WSL build status

- Installed `yarn` on Windows and installed `arcium-cli 0.8.5` directly in WSL.
- Confirmed the supported WSL toolchain is present: Solana `2.3.0`, Anchor `0.32.1`, Rust `1.89.0`.
- `arcium build` now compiles the encrypted Arcis crate successfully after refactoring the
  encrypted code to match Arcis constraints (`for` loops only, no `return`, explicit `Shared`
  recipient input).
- The current failure is no longer in the game logic. It is in the Solana/Anchor SBF build stage.

### Current blockers

- `arcium build` and `anchor build` both fail in the wrapper step with:
  `cargo_build_sbf: Can't get home directory path: environment variable not found`.
- Direct `cargo-build-sbf` exposed a separate Solana toolchain issue:
  the WSL `platform-tools` cache is incomplete/corrupted and is missing the extracted
  `platform-tools/rust/lib` directory expected by the SBF builder.
- A manual replacement download of the `platform-tools` archive in WSL was started and was making
  progress, but it was interrupted before completion.

### Consequence

- The encrypted instructions are validated.
- The full Anchor program has not yet been confirmed to compile to SBF.
- Real lifecycle tests have not been added yet because the build pipeline is not fully working.

### SBF compilation milestone

- Repaired the WSL Solana `platform-tools` cache by extracting the downloaded `v1.48` archive into
  `~/.cache/solana/v1.48/platform-tools`.
- A direct `cargo-build-sbf` run in a WSL-native copy of the repo now produces
  `target/deploy/fog_of_war_galactic_conquest.so`.
- `arcium build` still fails in its wrapper path with the same home-directory lookup error, so the
  direct SBF path is currently the reliable verification route.

### Remaining technical risk

- The SBF build emits many stack-frame warnings for the Anchor program, especially around callback
  handlers and large account deserialization paths.
- The binary is produced, but those stack warnings are severe and should be treated as a real
  deployability/runtime risk until the account and callback stack usage is reduced.

### Test status

- Updated the source-level tests to match the current generated callback names and hidden-state size.
- Added a localnet-gated Anchor integration scaffold that only runs when
  `RUN_ARCIUM_LOCALNET=1` is explicitly set.
- Full end-to-end Arcium lifecycle tests are still blocked on a working `arcium build` wrapper and
  an actual Arcium localnet runtime.

### Stack reduction pass

- Reworked the encrypted state to use a single packed `GalaxyState` byte array and a single packed
  visibility-report byte array instead of many separate encrypted fields.
- This reduced the generated encrypted payload sizes to:
  hidden state = `5` ciphertext words, visibility report = `2` ciphertext words.
- Updated the Anchor constants and account sizing to match the compact payloads.

### Build outcome after compression

- A direct `cargo-build-sbf` run in the WSL-native copy still succeeds and now no longer emits the
  large stack-frame warnings for this program's callbacks and account contexts.
- The remaining stack warning in the SBF log is from an `arcium_client` dependency helper, not from
  the project code paths that were previously overflowing.
- The `build/` artifacts generated in WSL were synced back into the main workspace so the encrypted
  instruction metadata matches the current code.

### Stack-frame mitigation: boxed GalaxyMatch accounts

- Wrapped `galaxy_match` in `Box<Account<'info, GalaxyMatch>>` across all nine Anchor account
  structs (CreateMatch, InitMatchCallback, RegisterPlayer, SubmitOrders, SubmitOrdersCallback,
  VisibilityCheck, VisibilityCheckCallback, ResolveTurn, ResolveTurnCallback).
- This moves the deserialized account data from the stack to the heap, which is the standard
  Anchor pattern for large accounts and directly addresses the SBF stack-frame warnings logged
  earlier.
- The account size was separately reduced via the packed byte-array refactor
  (HIDDEN_STATE_WORDS now 5, VISIBILITY_REPORT_WORDS now 2, SPACE now 522).
  Boxing remains good practice regardless of account size.

### WSL arcium-build wrapper script

- Added `scripts/wsl-arcium-build.sh` as a workaround for the `arcium build` HOME var issue.
- The script ensures `HOME`, Solana bin, and Cargo bin are on PATH before invoking `arcium build`.
- This targets the `cargo_build_sbf: Can't get home directory path` error that blocks the
  `arcium build` wrapper in WSL.
- Usage from WSL: `bash scripts/wsl-arcium-build.sh`

### Test assertion fix

- Fixed a pre-existing broken assertion in the source-level tests: the `visibility_check`
  function signature check was looking for a single-line substring that doesn't appear in the
  multi-line source. Replaced with two separate substring checks (`pub fn visibility_check(`
  and `ctx: Context<VisibilityCheck>`).
- Added a new assertion verifying that `galaxy_match` uses `Box<Account>` in the Anchor program,
  to guard against accidentally reverting the stack-safety fix.

### Arcium localnet requirements (research)

- `arcium test` is the single command that spins up the full localnet (Solana test-validator +
  Docker containers for Arcium MPC/Arx nodes + callback server).
- **Docker Desktop with WSL2 integration must be running** — this is a hard prerequisite.
- The `Arcium.toml` config (nodes=2, backends=["Cerberus"]) is already correct for the MVP.
- `arcium test` generates `artifacts/callback_server.log` and
  `artifacts/docker-compose-arx-env.yml` at runtime.
- Tests should use `@arcium-hq/client` (0.8.5) for helpers: `getArciumEnv()`,
  `uploadCircuit()`, `awaitComputationFinalization()`, `RescueCipher`, and PDA address helpers.
- File descriptor limits may need increasing in WSL:
  `sudo prlimit --pid $$ --nofile=1048576:1048576`
- The `arcium build` HOME var issue must be resolved before `arcium test` will work end-to-end.

### Source-level test fix for packed byte-array refactor

- The encrypted-program test assertions (test 2: "queues encrypted orders and resolves them
  together") were still checking for old struct-based patterns from before the packed byte-array
  refactor (`state.pending_submitted[player]`, `state.current_turn += 1`, etc.).
- Updated to match the current packed layout patterns:
  `state[player_slot(PENDING_SUBMITTED_OFFSET, player)] = 1;`,
  `state[player_slot(PENDING_ACTION_OFFSET, player)] == ACTION_ATTACK`,
  `state[CURRENT_TURN_INDEX] += 1;`, and the `type GalaxyState = Pack<[u8; STATE_BYTES]>;`
  type alias.

### Lifecycle tests pre-written

- Added `tests/lifecycle.ts` — a full Arcium localnet lifecycle test covering all seven MVP
  test cases from the spec:
  1. Match creation + MatchReady event
  2. Registration (accept, reject duplicate, reject over-registration)
  3. Order submission (reject unregistered caller)
  4. Turn resolution (reject before all submitted)
  5. Both players submit + resolve advances turn state
  6. Visibility scoped to caller's own slot
  7. Winner declared when one command fleet is destroyed
- Tests are gated behind `RUN_ARCIUM_LOCALNET=1` and self-skip otherwise.
- Uses `@arcium-hq/client` helpers (already in `package.json`): `getArciumEnv`,
  `uploadCircuit`, `awaitComputationFinalization`, `RescueCipher`, `x25519`, PDA helpers.
- The test script glob in `Anchor.toml` (`tests/**/*.ts`) already picks up the new file.

## 2026-03-03

### arcium build now passes end-to-end in WSL

- Root cause of "Anchor CLI not installed": the `arcium` CLI runs `anchor version`
  (no dashes), and the native Linux anchor wrapper script only handled `--version` and `-V`.
  Added `version` to the case statement.
- Root cause of broken shebang: heredoc expansion in bash escaped `#!` to `#\!`. When
  arcium (a Rust binary) spawned the script via `Command::new`, the kernel rejected the
  invalid shebang. Bash itself masked this by falling back to sourcing. Fixed by writing
  the wrapper script on the Windows side and copying it into WSL.

### edition2024 blocker resolved

- Platform-tools v1.48 ships Cargo 1.84.0 which cannot parse `edition = "2024"` manifests.
- The Arcium SDK (arcis-compiler 0.8.5) transitively depends on `const-oid ≥0.10.0-rc.0`,
  `base64ct ≥1.8`, and `time-macros ≥0.2.27` — all of which now publish only edition2024
  versions on crates.io. This is a known Solana ecosystem issue
  (https://github.com/anza-xyz/agave/issues/8443).
- Upgraded to platform-tools v1.53 (Cargo 1.89.0, Clang 20.1.7) which supports edition2024.
- Downloaded from https://github.com/anza-xyz/platform-tools/releases/download/v1.53/
  and extracted to `~/.cache/solana/v1.53/platform-tools/`.

### Cross-compilation fixes for platform-tools v1.52/v1.53

- The v1.52+ Clang falls through to system `/usr/include/stdint.h` which needs
  `bits/libc-header-start.h` (missing without libc6-dev-i386) and then fails on
  `sizeof(size_t) == sizeof(uintptr_t)` (64-bit host headers vs 32-bit SBF target).
- Fix: use the v1.53 Clang with `--sysroot` pointing to the bundled newlib sysroot:
  ```
  CC_sbpf_solana_solana="$PT/llvm/bin/clang"
  CFLAGS_sbpf_solana_solana="--sysroot=$PT/llvm/sbpfv2 -isystem $PT/llvm/include"
  ```
- The `encrypted-ixs` crate pulls `getrandom v0.3.4` which doesn't compile for the
  `sbpf-solana-solana` target. Fixed by passing `-p fog_of_war_galactic_conquest` to
  `cargo-build-sbf` to build only the Anchor program.

### Updated anchor wrapper

- The anchor wrapper at `/home/bolaji/.cargo/bin/anchor` (backup at `.bak`) now:
  - Sets `CC_sbpf_solana_solana` and `CFLAGS_sbpf_solana_solana` for the v1.53 sysroot
  - Passes `--tools-version v1.53` and `-p fog_of_war_galactic_conquest` to `cargo-build-sbf`
  - Handles `build`, `keys sync`, `version`/`--version`/`-V`, `clean`
- The canonical source is `scripts/anchor-wrapper.sh` in the Windows workspace.

### Build output

- `target/deploy/fog_of_war_galactic_conquest.so` — 604 KB, compiled successfully.
- One stack-frame warning from `arcium_client` internal code (721 KB frame in
  `Account::try_from`). This is in the Arcium SDK, not in project code.
- Build artifacts synced back to the Windows workspace.

### Remaining next steps

- Ensure Docker Desktop WSL2 integration is active, then attempt `arcium test`.
- Run the lifecycle tests with `RUN_ARCIUM_LOCALNET=1 arcium test` and fix any runtime issues
  (encryption format, account resolution, event names).
- The `arcium build` recipe requires platform-tools v1.53 to be cached at
  `~/.cache/solana/v1.53/platform-tools/`. If the WSL environment is reset, re-download from
  the GitHub releases page and extract.

### Pre-runtime lifecycle test hardening

- Fixed a concrete PDA-derivation bug in `tests/lifecycle.ts`: the test was calling
  `Buffer.from(getCompDefAccOffset(...)).readUInt32LE()`, which is not a valid way to pass the
  computation-definition offset into `getCompDefAccAddress`.
- Replaced those calls with a dedicated helper that passes `getCompDefAccOffset(circuitName)`
  directly, so `compDefAccount` now resolves the intended PDA consistently for all four circuits.
- Added the missing authorization test case for a registered player attempting to submit orders
  for another player's slot (`PlayerIndexMismatch` path), which was part of the documented
  lifecycle coverage but had not actually been implemented in the file.

### Windows test-runner dependencies resolved

- Ran `npm install` to install all Node dev dependencies.
- Fixed `__dirname` ESM compatibility issue in `tests/fog_of_war_galactic_conquest.ts` —
  Node 24 loads `.ts` files as ESM by default, so replaced `__dirname` with
  `path.dirname(fileURLToPath(import.meta.url))`.
- Source-level tests now pass: 3 passing, 1 pending (localnet scaffold, expected).

### First `arcium test` attempt with Docker live

- Confirmed Docker is reachable from WSL (`docker info` succeeds; no Arcium containers were left
  running after the attempt).
- `arcium test` now gets through the build stage under WSL and produces a live log at
  `artifacts/localnet/arcium-test-live.log`.
- The log shows:
  - `fog_of_war_galactic_conquest` compiles successfully under SBF
  - the known `arcium_client` stack-frame warning still appears (dependency code only)
  - `Clean completed successfully!`
  - final failure: `Error: Failed to read keypair file`
- `artifacts/localnet/` is created, but no callback server or docker-compose runtime files were
  emitted yet, which means the process failed before the full localnet stack came up.
- Next blocker is no longer build or Docker reachability; it is identifying which keypair path
  `arcium test` expects and making sure that file exists/is readable inside WSL.

### Devnet deployment completed

- The program is now deployed to Solana devnet at:
  `BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE`
- This matches the declared program ID already used in the Anchor program and repo config, so no
  program-ID rotation is needed from the current code state.
- The project is now past build-only validation and ready for devnet initialization/smoke testing.

### MXE initialized on devnet

- Ran `arcium init-mxe --callback-program BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE
  --cluster-offset 456 --keypair-path ~/.config/solana/id.json --recovery-set-size 4 -u devnet`.
- MXE account initialized successfully. Explorer tx:
  `NTxzje24Rc72Np5g9tXXCFyQncBh85QADqzKVCaAkBz4eKQDGXJJzGRwKCddB4DLHgeYfstWj9a1FnSL1KTdwe7`
- Using devnet cluster offset 456 (2/2 nodes, 510 MXEs).
- Added `[clusters.devnet] offset = 456` to `Arcium.toml`.

### Anchor IDL generated manually

- Anchor's `idl-build` feature fails for arcium programs because the `#[arcium_program]` macro
  generates callback instruction variants that the IDL extractor can't resolve
  (`cannot find InitMatchCallback in instruction`).
- Additionally, the IDL build requires `+nightly` toolchain for `proc_macro2::Span::source_file()`.
- Workaround: hand-crafted `target/idl/fog_of_war_galactic_conquest.json` covering all 13
  instructions, the `GalaxyMatch` account type, 3 events, and 14 error codes.
- Discriminators generated via SHA256 sighash (`global:<snake_case_name>`), matching Anchor 0.32.
- Known-program addresses patched in (systemProgram, arciumProgram, lutProgram, instructionsSysvar)
  so Anchor auto-resolves them without explicit passing.

### Anchor wrapper updated for devnet testing

- Added native Linux node PATH (`~/.local/node-v20.20.0-linux-x64/bin`) at the top of the wrapper
  to prevent Windows `npx` from being used (was causing `CMD.EXE` errors).
- Added `--provider.cluster` flag parsing so the wrapper sets `ANCHOR_PROVIDER_URL` correctly for
  devnet/mainnet.
- Added `.env` sourcing to load private RPC endpoints before setting `ANCHOR_PROVIDER_URL`.
- Devnet preference chain: QuickNode → Helius → public devnet.

### Private RPC endpoints configured

- Created `.env` (gitignored) with private RPC endpoints:
  - Helius devnet (rate-limited on free tier — hits 429s on heavy use)
  - QuickNode devnet (best performance, no rate limiting observed)
  - Alchemy devnet
  - ZAN devnet
  - Public `api.devnet.solana.com` fallback
- Created `tests/rpc-config.ts` with multi-RPC failover pool for future test use.
- Installed `dotenv` as dev dependency.

### Lifecycle test fixes for devnet

- Replaced `requestAirdrop` with `SystemProgram.transfer` from the owner wallet on devnet
  (devnet faucet is rate-limited to 1 SOL/day/project).
- Reduced test wallet funding from 2 SOL to 0.1 SOL each (only need tx fees).
- Added `lutProgram` and `arciumProgram` to `initCompDef` accounts (the hand-crafted IDL
  requires explicit passing since these are `UncheckedAccount` types, not `Program<>` types).

### Devnet test progress

- `arcium test --cluster devnet --skip-build` now reaches circuit upload phase.
- 3 of 4 computation definitions initialized on-chain: `init_match`, `submit_orders`,
  `visibility_check`. `resolve_turn` still pending.
- Circuit upload is the main SOL consumer (~2 SOL per circuit for on-chain account rent).
- No raw circuit accounts persisted yet — uploads start fresh each run.
- **Blocker**: insufficient SOL for remaining circuit uploads.

### All 4 compDefs confirmed on-chain

- Verified via `scripts/upload-circuits.ts --check` that all 4 computation definitions
  are initialized on devnet:
  - `init_match`: compDef=YES, circuit=NO
  - `submit_orders`: compDef=YES, circuit=NO
  - `visibility_check`: compDef=YES, circuit=NO
  - `resolve_turn`: compDef=YES, circuit=NO
- The `resolve_turn` compDef was initialized in a prior run but DEV_NOTES weren't updated.

### Incremental circuit upload script

- Created `scripts/upload-circuits.ts` — a standalone script that uploads circuits one at
  a time with skip-if-exists logic.
- Features:
  - `--check` mode: reports compDef/circuit status without spending SOL
  - `--circuit <name>`: upload a single named circuit
  - Checks balance before each upload and stops if < 1.5 SOL to preserve funds
  - Resumes from where it left off (skips already-initialized compDefs and uploaded circuits)
- Each circuit upload costs ~2 SOL for on-chain account rent (16-18 resize transactions).
- Added `upload-circuits` and `upload-circuits:check` npm scripts.

### Current blocker

- Wallet balance: 0.39 SOL. Need ~8 SOL total for all 4 circuit uploads (~2 SOL each).
- Fund wallet `3qNGz5uNMLjQePib2ibi5p1hGzLz7MYyUn4RUc3C6wGa` and run:
  ```
  wsl -- bash -c 'cd ~/fog-build-tmp && source .env && \
    ANCHOR_PROVIDER_URL="$QUICKNODE_RPC_URL" ANCHOR_WALLET="$HOME/.config/solana/id.json" \
    npx ts-node scripts/upload-circuits.ts'
  ```
- Can also upload one circuit at a time with `--circuit init_match` etc.

### Remaining next steps

- Upload all 4 circuits (~8 SOL needed).
- Complete `arcium test --cluster devnet` end-to-end.
- Fix any runtime test failures in the lifecycle test cases.

### First incremental upload attempt (actual rent cost observed)

- Ran `scripts/upload-circuits.ts --check` against devnet on QuickNode:
  all 4 compDefs are present, and the script still reports all 4 circuits as `NO`.
- Ran `scripts/upload-circuits.ts --circuit init_match` first (smallest artifact).
  `uploadCircuit()` reported `Raw circuit acc 0 already exists with sufficient size, skipping`
  and completed without reducing wallet balance.
- The follow-up `--check` still reported `init_match: circuit=NO`, which means the current
  `isCircuitUploaded()` heuristic (`compDef.rawCircuit`) is not a reliable indicator for every
  upload state.
- Ran `scripts/upload-circuits.ts --circuit submit_orders` next.
  It progressed through resize transactions `0` to `5`, then failed on resize tx `6 of 11` with:
  `Transfer: insufficient lamports 38289797, need 71270400`.
- Live balance after the failed `submit_orders` attempt is `0.750998797 SOL`
  (starting balance before upload was `8.448236997 SOL`).
- This means the previous planning heuristic of `~2 SOL per circuit` is too low for the larger
  circuits and should no longer be treated as a safe funding estimate.

### Updated funding guidance

- `init_match` may already have a sufficiently-sized raw circuit account and may not require
  additional rent.
- Larger circuits (`submit_orders`, `resolve_turn`, `visibility_check`) can consume far more than
  `~2 SOL` each due to repeated raw-account resize transactions.
- Current blocker is not just "upload the circuits"; it is funding the wallet enough to resume the
  partially-started `submit_orders` upload and then complete the remaining larger uploads.
- Re-run the incremental uploader after funding; it should resume from the existing partial raw
  circuit account instead of starting from zero.

### Incremental uploads resumed after wallet funding

- Wallet was funded to `29.443570225 SOL` and uploads were resumed incrementally on devnet.
- `submit_orders`:
  - First resumed attempt completed all `11` resize transactions, then failed at chunk upload
    start with `failed to get recent blockhash: TypeError: fetch failed`.
  - Balance after that partial progress: `23.845763185 SOL`.
  - Immediate retry succeeded; `uploadCircuit()` reported
    `Raw circuit acc 0 already exists with sufficient size, skipping`, then finalized the circuit.
- `resolve_turn`:
  - First attempt timed out on resize tx `2 of 16`, but the tx later confirmed as `Finalized`.
  - Retry completed all `16` resize transactions and reached chunk upload (`3524` upload txs,
    chunk `1 of 8`).
  - Chunk upload then hit heavy QuickNode rate limiting:
    repeated `429 Too Many Requests`, `signatureSubscribe` `-32007` errors
    (`15/second request limit reached`), then ended with
    `failed to get recent blockhash: TypeError: fetch failed`.
- Live balance after the `resolve_turn` resize phase is `9.083371705 SOL`.

### Current practical blocker

- The next blocker is now RPC throughput, not wallet funding:
  QuickNode's devnet plan is throttling the high-volume chunk upload phase used by
  `uploadCircuit()`.
- The expensive raw-account resize/rent phases for `submit_orders` and `resolve_turn` have already
  been paid for; the remaining work should primarily be retrying chunk uploads on an RPC endpoint
  that can tolerate the burst pattern.
- Safest next move: retry `resolve_turn` and the remaining circuits using a different private RPC
  endpoint (for example Alchemy or ZAN), or reduce request rate in the uploader before retrying.

### RPC switch and further upload progress

- Retried `resolve_turn` after the QuickNode failure.
  `uploadCircuit()` now reports `Raw circuit acc 0 already exists with sufficient size, skipping`
  and finalizes successfully, so `resolve_turn` should be considered uploaded despite the earlier
  chunk-upload throttle failure.
- To avoid QuickNode throttling, switched the next upload attempt to the public devnet RPC
  (`https://api.devnet.solana.com`) explicitly.
- Ran `scripts/upload-circuits.ts --circuit visibility_check` on the public devnet endpoint.
  This confirmed the RPC switch worked (`RPC: api.devnet.solana.com` in script output).
- `visibility_check` progressed through resize tx `0` to `6`, then failed on resize tx `7 of 18`
  with:
  `Transfer: insufficient lamports 31985905, need 71270400`.
- Live wallet balance after that partial `visibility_check` resize is `0.103261305 SOL`.

### Updated blocker after RPC switch

- QuickNode rate limits are no longer the immediate blocker for the remaining work.
- The remaining blocker is wallet funding again: `visibility_check` is the largest circuit and its
  raw-account resize phase consumed nearly all remaining SOL even on the public devnet RPC.
- Current likely state:
  - `init_match`: effectively available / pre-sized
  - `submit_orders`: uploaded
  - `resolve_turn`: uploaded
  - `visibility_check`: partially resized, needs more SOL, then a retry should resume

### `visibility_check` completed after funding

- Wallet was later funded to `30.33162946 SOL` and `visibility_check` was retried on the public
  devnet RPC to avoid QuickNode throttling.
- First retry:
  - completed all `18` resize transactions
  - reached chunk upload (`3898` upload txs, chunk `1 of 8`)
  - failed at chunk start with `failed to get recent blockhash: TypeError: fetch failed`
- Balance after the completed resize phase: `27.56240058 SOL`
- Immediate retry then succeeded:
  `Raw circuit acc 0 already exists with sufficient size, skipping`
  and `Circuit visibility_check uploaded successfully!`

### Circuit upload milestone complete

- Practical upload status is now:
  - `init_match`: available / pre-sized
  - `submit_orders`: uploaded
  - `resolve_turn`: uploaded
  - `visibility_check`: uploaded
- `scripts/upload-circuits.ts --check` still reports `circuit=NO` for all four circuits because
  the current `isCircuitUploaded()` heuristic (`compDef.rawCircuit`) does not reflect the actual
  successful state after `uploadCircuit()` finalization.
- Do not rely on the current `--check` result as the source of truth for upload completion.
- Live wallet balance after finishing the upload milestone: `27.56239558 SOL`.

### First devnet lifecycle test run

- Ran `npx ts-mocha` with `RUN_ARCIUM_LOCALNET=1 ARCIUM_CLUSTER_OFFSET=456` on QuickNode devnet.
- Source-level tests: 4 passing.
- Lifecycle tests: 10 passing, 5 failing on first run.

#### Errors fixed so far

1. **`ARCIUM_CLUSTER_OFFSET` not set** — `getArciumEnv()` requires `ARCIUM_CLUSTER_OFFSET=456` as
   an environment variable. Added to test runner invocation.

2. **`Account signPdaAccount not provided`** — The hand-crafted IDL already included
   `signPdaAccount` in `createMatch`, `submitOrders`, `visibilityCheck`, `resolveTurn`, but the
   test code wasn't passing it. Fixed by deriving the PDA
   (`PublicKey.findProgramAddressSync([Buffer.from("ArciumSignerAccount")], program.programId)`)
   and passing it to all instruction calls.

3. **`Account poolAccount / clockAccount not provided`** — Same pattern: IDL has them but without
   address hints, so Anchor can't auto-resolve. Fixed by importing `getFeePoolAccAddress()` and
   `getClockAccAddress()` from `@arcium-hq/client` and passing explicitly.

4. **`u coordinate must be hex string or Uint8Array`** — `getMXEPublicKey()` returns a value that
   `x25519.getSharedSecret()` rejects. Wrapped with `new Uint8Array(mxePublicKey)`.

#### Remaining failures after fixes

1. **`comp_def_account: AccountNotInitialized` (Error 3012)** — The compDef PDAs exist on-chain
   (verified via debug script), but the program reports them as not initialized. Root cause is
   likely that the `#[queue_computation_accounts]` proc macro injects additional hidden accounts
   into the Anchor struct, shifting account positions. The hand-crafted IDL doesn't include these
   invisible macro-injected accounts, so Anchor serializes accounts in the wrong order and the
   program sees a wrong account in the `comp_def_account` slot.

2. **`u coordinate of length 32 expected, got 0`** — `getMXEPublicKey()` returns `null` on devnet,
   meaning the MXE account's public key field is not populated. This blocks x25519 encryption
   for `submitOrders` and `visibilityCheck`. The MXE nodes on devnet may not have completed
   key exchange, or the public key is stored differently than expected.

3. **`galaxy_match: AccountNotInitialized`** — Cascading failure because `createMatch` (test 1)
   fails, so the match PDA is never created.

#### On-chain debug output

- Sign PDA derived from our program ID: `5DHRwuTSZTEukhppkG5Untaz2L4PdhFHiHVdyaaA755s`
  (does not exist on-chain yet — expected, `init_if_needed` creates it on first use).
- Sign PDA derived from Arcium program ID: `3iJUqefe12B14HVnedJGhmbS9uTGvdy1vnxD5kXVtAj4`
  (also does not exist — rules out wrong program ID derivation as cause).
- All 4 compDef PDAs verified on-chain (sizes 107–121 bytes).
- `getMXEPublicKey()` fails: `Received null` for the public key field.

## 2026-03-03

### compDef PDA derivation bug fixed

- **Root cause**: `getProgramCompDefAccount()` in `tests/lifecycle.ts` was calling
  `getCompDefAccAddress(programId, getCompDefAccOffset(circuitName))` where the second argument
  is a `Uint8Array`, but the function signature expects a `number`. JavaScript coerces the
  Uint8Array to NaN, and `Buffer.writeUInt32LE(NaN)` writes 0, producing a completely wrong PDA.
- **Fix**: Replaced `getProgramCompDefAccount` with a direct PDA derivation using
  `PublicKey.findProgramAddressSync([baseSeed, programId.toBuffer(), offset], getArciumProgramId())`
  — the same derivation used in `initCompDef`, guaranteed to match the on-chain accounts.
- This resolved the `comp_def_account: AccountNotInitialized` (Error 3012) error.

### `#[queue_computation_accounts]` macro investigated

- The macro does NOT inject hidden accounts into the Anchor struct. It only validates that all
  12 required accounts are present and implements the `QueueCompAccs<'info>` trait.
- Required accounts: `payer`, `sign_pda_account`, `mxe_account`, `mempool_account`,
  `executing_pool`, `computation_account`, `comp_def_account`, `cluster_account`,
  `pool_account`, `clock_account`, `system_program`, `arcium_program`.
- The hand-crafted IDL already has all accounts in the correct order. The issue was purely the
  PDA derivation bug described above.

### MXE public key unavailability diagnosed

- **Root cause**: `getMXEPublicKey()` reads `utilityPubkeys` from the MXE account. It returns
  `null` when the field is in the `unset` state (i.e., not all MXE cluster nodes have completed
  their key exchange).
- The previous `getMXEPublicKeyWithRetry` only caught exceptions, but `getMXEPublicKey` returns
  `null` rather than throwing when the key isn't ready. This caused `null` to flow through to
  `x25519.getSharedSecret()`, resulting in `u coordinate of length 32 expected, got 0`.
- **Fix**: Updated retry logic to check for null/empty returns in addition to exceptions, and
  prints clear progress messages during retries.
- On-chain, the Arcium program also validates MXE readiness: `createMatch` (and all other
  `queue_computation` calls) fail with `MxeKeysNotSet` (Error 6002) if MXE cluster nodes
  haven't completed key agreement.
- This is a **devnet infrastructure issue** — there is nothing to fix from the client side.

### Test suite restructured for graceful MXE degradation

- Tests that require MXE readiness (createMatch, registerPlayer, submitOrders, visibilityCheck,
  resolveTurn, winner detection) now skip with `this.skip()` when `mxePublicKey` is null.
- Negative/guard-rail tests continue to pass regardless of MXE state because they fail at
  program-level authorization checks before reaching the `queue_computation` CPI.

### Second devnet lifecycle test run results

- **6 passing**: all negative/authorization tests
  - rejects duplicate registration
  - rejects third player (match full)
  - rejects unregistered submit
  - rejects spoofed player slot
  - rejects resolve_turn before all submitted
  - rejects unregistered visibility request
- **5 pending** (skipped): all positive lifecycle tests
  - creates a match (MXE keys not set)
  - player 2 registration (depends on createMatch)
  - submit orders + resolve turn (needs MXE encryption)
  - visibility check (needs MXE encryption)
  - winner detection (needs MXE encryption)
- **0 failing**: all client-side bugs are resolved.

### Remaining blocker

- The only remaining blocker is **MXE cluster key exchange on devnet**. The MXE nodes at cluster
  offset 456 have not completed their key agreement protocol, causing:
  1. `getMXEPublicKey()` to return null (client-side)
  2. `MxeKeysNotSet` (Error 6002) on-chain for any `queue_computation` CPI
- Once the MXE cluster completes key exchange, the full lifecycle test suite should pass
  end-to-end with no code changes needed.

### Remaining next steps

- Monitor MXE cluster status on devnet (check if `getMXEPublicKey()` returns a 32-byte key).
- Once MXE keys are set, re-run the full lifecycle test suite to validate the complete flow.
- Possible alternatives if devnet MXE remains unavailable:
  - Contact Arcium team about devnet cluster status
  - Try a different cluster offset
  - Set up a local Arcium test environment via `arcium test` with Docker

## 2026-03-04

### SDK and frontend contract fixes

- Aligned `sdk/constants.ts` unit semantics with the live encrypted program:
  `Fighter = 0`, `Scout = 1`, `Command = 2`. Removed the mismatched client-only
  `Frigate` / `Destroyer` mapping from the exported enum and `UNIT_STATS`.
- Updated `sdk/client.ts` queued instruction helpers to return computation metadata:
  `createMatch` now returns `computationOffset`, and `submitOrders`, `requestVisibility`,
  and `resolveTurn` now return queued-operation results instead of only a tx signature.
- Fixed `requestVisibility()` so it uses the caller's supplied private key to derive the
  request public key, and returns the nonce/public key context needed for later decrypt flow.
- Patched `GameClient` construction so a supplied `programId` also rewrites the IDL address
  used by the Anchor `Program` instance, preventing PDA/program mismatches when overriding IDs.

### Frontend async flow fixes

- `app/src/components/CreateMatchModal.tsx` now waits for the queued `createMatch`
  computation to finalize before routing into the match page.
- `app/src/app/match/[id]/page.tsx` now waits for finalization after `submitOrders`,
  `resolveTurn`, and `requestVisibility` before refreshing match state.
- This avoids stale immediate reads after queue submission and makes the UI behavior match the
  actual callback-driven program lifecycle.

### Repo hygiene fixes

- Replaced the default `create-next-app` boilerplate in `app/README.md` with a project-specific
  frontend README.
- Added `.claude/`, `.vscode/`, and `NUL` to `.gitignore` so local tooling noise is not surfaced
  as commit-worthy repo changes.

### Frontend lint cleanup

- Fixed the Next.js navigation lint issue in `app/src/app/layout.tsx` by replacing the raw
  home-page `<a>` tag with `next/link`.
- Removed unused imports and replaced `catch (err: any)` with typed `unknown` handling in the
  app components/hooks touched during the SDK integration pass.
- Updated `app/src/components/OrderPanel.tsx` to use the aligned SDK unit labels
  (`Fighter`, `Scout`, `Command Fleet`) and moved the selected-cell sync out of render-time
  state writes into a `useEffect`.
- Ran `npm --prefix app run lint` successfully after these fixes.
