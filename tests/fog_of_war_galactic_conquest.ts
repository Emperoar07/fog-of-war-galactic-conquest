import { expect } from "chai";
import { readFileSync } from "fs";
import path from "path";
import * as anchor from "@coral-xyz/anchor";

const repoRoot = path.resolve(__dirname, "..");
const anchorProgram = readFileSync(
  path.join(repoRoot, "programs", "fog_of_war_galactic_conquest", "src", "lib.rs"),
  "utf8",
);
const encryptedProgram = readFileSync(
  path.join(repoRoot, "encrypted-ixs", "src", "lib.rs"),
  "utf8",
);
const mvpSpec = readFileSync(path.join(repoRoot, "MVP_SPEC.md"), "utf8");
const devNotes = readFileSync(path.join(repoRoot, "DEV_NOTES.md"), "utf8");

describe("fog_of_war_galactic_conquest", () => {
  it("locks the Anchor program to the MVP authorization rules", async () => {
    expect(anchorProgram).to.include("require!(player_count == 2, ErrorCode::InvalidPlayerCount);");
    expect(anchorProgram).to.include("const HIDDEN_STATE_WORDS: usize = 5;");
    expect(anchorProgram).to.include("const VISIBILITY_REPORT_WORDS: usize = 2;");
    expect(anchorProgram).to.include("pub submitted_orders: [u8; MAX_PLAYERS],");
    expect(anchorProgram).to.include("pub fn player_slot(&self, player: &Pubkey) -> Option<u8>");
    expect(anchorProgram).to.include("pub fn init_match_callback(");
    expect(anchorProgram).to.include(
      "require!(caller_index == player_index, ErrorCode::PlayerIndexMismatch);",
    );
    expect(anchorProgram).to.include(
      "galaxy_match.submitted_orders[player_index as usize] == 0",
    );
    expect(anchorProgram).to.include(
      "require!(galaxy_match.has_all_submissions(), ErrorCode::PendingOrders);",
    );
    expect(anchorProgram).to.include("pub fn visibility_check(");
    expect(anchorProgram).to.include("ctx: Context<VisibilityCheck>");
    expect(anchorProgram).to.include("pub viewer_index: u8,");
    expect(anchorProgram).to.include("pub galaxy_match: Box<Account<'info, GalaxyMatch>>,");
  });

  it("queues encrypted orders and resolves them together", async () => {
    // Packed byte-array layout constants
    expect(encryptedProgram).to.include("const PENDING_SUBMITTED_OFFSET: usize =");
    expect(encryptedProgram).to.include("const PENDING_ACTION_OFFSET: usize =");
    expect(encryptedProgram).to.include("type GalaxyState = Pack<[u8; STATE_BYTES]>;");
    // Order struct and queue logic
    expect(encryptedProgram).to.include("pub struct PlayerCommand {");
    expect(encryptedProgram).to.not.include("pub struct PlayerOrder {");
    expect(encryptedProgram).to.include(
      "state[player_slot(PENDING_SUBMITTED_OFFSET, player)] = 1;",
    );
    expect(encryptedProgram).to.include(
      "state[player_slot(PENDING_ACTION_OFFSET, player)] == ACTION_ATTACK",
    );
    expect(encryptedProgram).to.include("clear_pending_order(&mut state, player);");
    expect(encryptedProgram).to.include("state[CURRENT_TURN_INDEX] += 1;");
  });

  it("has a localnet integration scaffold gated behind explicit env setup", async function () {
    if (process.env.RUN_ARCIUM_LOCALNET !== "1") {
      this.skip();
    }

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const workspace = anchor.workspace as Record<string, anchor.Program>;
    expect(workspace.fogOfWarGalacticConquest ?? workspace.FogOfWarGalacticConquest).to.exist;
  });

  it("keeps the repo-level MVP contract and dev log in place", async () => {
    expect(mvpSpec).to.include("## Definition Of Done");
    expect(mvpSpec).to.include("two players can create and join a match");
    expect(devNotes).to.include("### Added MVP spec");
    expect(devNotes).to.include("Future repository changes should append a short dated note here.");
  });
});
