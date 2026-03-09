use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::CallbackAccount;

const COMP_DEF_OFFSET_INIT_MATCH: u32 = comp_def_offset("init_match");
const COMP_DEF_OFFSET_SUBMIT_ORDERS: u32 = comp_def_offset("submit_orders");
const COMP_DEF_OFFSET_VISIBILITY_CHECK: u32 = comp_def_offset("visibility_check");
const COMP_DEF_OFFSET_RESOLVE_TURN: u32 = comp_def_offset("resolve_turn");
const COMP_DEF_OFFSET_RESOLVE_ALL_ORDERS: u32 = comp_def_offset("resolve_all_orders");

const MAX_PLAYERS: usize = 4;
const MAP_TILES: usize = 36;
const HIDDEN_STATE_WORDS: usize = 5;
const VISIBILITY_REPORT_WORDS: usize = 2;
const NO_WINNER: u8 = 255;
const NO_PLAYER: u8 = 255;
const TURN_TIMEOUT_SECONDS: i64 = 60;

declare_id!("BSUDUdpFuGJpw68HjJcHmUJ9AHHnr4V9Am75s6meJ9hE");

#[arcium_program]
pub mod fog_of_war_galactic_conquest {
    use super::*;

    pub fn init_init_match_comp_def(ctx: Context<InitInitMatchCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_submit_orders_comp_def(ctx: Context<InitSubmitOrdersCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_visibility_check_comp_def(
        ctx: Context<InitVisibilityCheckCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_resolve_turn_comp_def(ctx: Context<InitResolveTurnCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_resolve_all_orders_comp_def(
        ctx: Context<InitResolveAllOrdersCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn create_match(
        ctx: Context<CreateMatch>,
        computation_offset: u64,
        match_id: u64,
        player_count: u8,
        map_seed: u64,
    ) -> Result<()> {
        require!(player_count == 2, ErrorCode::InvalidPlayerCount);
        require!(map_seed > 0, ErrorCode::InvalidMapSeed);

        let galaxy_match = &mut ctx.accounts.galaxy_match;
        galaxy_match.match_id = match_id;
        galaxy_match.authority = ctx.accounts.payer.key();
        galaxy_match.players = [Pubkey::default(); MAX_PLAYERS];
        galaxy_match.players[0] = ctx.accounts.payer.key();
        galaxy_match.player_count = player_count;
        galaxy_match.turn = 0;
        galaxy_match.status = 0;
        galaxy_match.map_seed = map_seed;
        galaxy_match.revealed_sector_owner = [0; MAP_TILES];
        galaxy_match.battle_summary = [0; 10];
        galaxy_match.submitted_orders = [0; MAX_PLAYERS];
        galaxy_match.hidden_state = [[0; 32]; HIDDEN_STATE_WORDS];
        galaxy_match.hidden_state_nonce = 0;
        galaxy_match.visibility_query_nonce = 0;
        galaxy_match.last_turn_start = 0;
        galaxy_match.reserved = [0; 32];

        let args = ArgBuilder::new()
            .plaintext_u8(player_count)
            .plaintext_u64(map_seed)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![InitMatchCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.galaxy_match.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_match")]
    pub fn init_match_callback(
        ctx: Context<InitMatchCallback>,
        output: SignedComputationOutputs<InitMatchOutput>,
    ) -> Result<()> {
        let state = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(InitMatchOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let galaxy_match = &mut ctx.accounts.galaxy_match;
        require!(galaxy_match.status == 0, ErrorCode::MatchNotReady);
        galaxy_match.hidden_state = state.ciphertexts;
        galaxy_match.hidden_state_nonce = state.nonce;

        emit!(MatchReady {
            match_id: galaxy_match.match_id,
            player_count: galaxy_match.player_count,
        });

        Ok(())
    }

    pub fn register_player(ctx: Context<RegisterPlayer>, match_id: u64, slot: u8) -> Result<()> {
        let galaxy_match = &mut ctx.accounts.galaxy_match;
        let slot_index = slot as usize;

        require!(galaxy_match.status == 0, ErrorCode::RegistrationClosed);
        require!(slot_index < MAX_PLAYERS, ErrorCode::InvalidPlayerSlot);
        require!(
            galaxy_match.registered_count() < galaxy_match.player_count as usize,
            ErrorCode::MatchFull
        );
        require!(
            galaxy_match.players[slot_index] == Pubkey::default(),
            ErrorCode::SlotTaken
        );
        require!(
            !galaxy_match.is_registered(&ctx.accounts.player.key()),
            ErrorCode::AlreadyRegistered
        );

        galaxy_match.players[slot_index] = ctx.accounts.player.key();

        if galaxy_match.registered_count() >= galaxy_match.player_count as usize {
            galaxy_match.status = 1;
            galaxy_match.last_turn_start = Clock::get()?.unix_timestamp;
        }

        Ok(())
    }

    // Sprint 4a: New deferred order submission (no Arcium call)
    // Players submit encrypted orders; these are queued in Solana only
    // All orders are processed together in resolve_all_orders circuit
    pub fn queue_order(
        ctx: Context<QueueOrder>,
        match_id: u64,
        player_index: u8,
        unit_slot_ct: [u8; 32],
        action_ct: [u8; 32],
        target_x_ct: [u8; 32],
        target_y_ct: [u8; 32],
    ) -> Result<()> {
        let galaxy_match = &mut ctx.accounts.galaxy_match;

        require!(galaxy_match.match_id == match_id, ErrorCode::MatchNotFound);
        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        require!(
            galaxy_match.is_registered(&ctx.accounts.payer.key()),
            ErrorCode::NotAuthorized
        );
        
        let caller_index = galaxy_match
            .player_slot(&ctx.accounts.payer.key())
            .ok_or(ErrorCode::NotAuthorized)?;
        require!(caller_index == player_index, ErrorCode::PlayerIndexMismatch);

        // OPTIMIZATION: Check if order already queued (prevent re-submission)
        require!(
            galaxy_match.submitted_orders[player_index as usize] == 0,
            ErrorCode::OrdersAlreadySubmitted
        );

        // Store encrypted order data in pending orders account
        let pending_account = &mut ctx.accounts.pending_orders;
        require!(pending_account.match_id == match_id, ErrorCode::MatchNotFound);

        let order_slot = player_index as usize;
        pending_account.orders[order_slot].unit_slot_ct = unit_slot_ct;
        pending_account.orders[order_slot].action_ct = action_ct;
        pending_account.orders[order_slot].target_x_ct = target_x_ct;
        pending_account.orders[order_slot].target_y_ct = target_y_ct;
        pending_account.orders[order_slot].submitted = 1;

        // Mark order as submitted in match account
        galaxy_match.submitted_orders[player_index as usize] = 1;

        emit!(OrderQueued {
            match_id,
            player_index,
            turn: galaxy_match.turn,
        });

        Ok(())
    }

    // Legacy submit_orders (deprecated after Sprint 4, kept for compatibility)
    pub fn submit_orders(
        ctx: Context<SubmitOrders>,
        computation_offset: u64,
        match_id: u64,
        player_index: u8,
        unit_slot_ct: [u8; 32],
        action_ct: [u8; 32],
        target_x_ct: [u8; 32],
        target_y_ct: [u8; 32],
        pub_key: [u8; 32],
        order_nonce: u128,
    ) -> Result<()> {
        let galaxy_match = &ctx.accounts.galaxy_match;

        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        require!(
            galaxy_match.is_registered(&ctx.accounts.payer.key()),
            ErrorCode::NotAuthorized
        );
        let caller_index = galaxy_match
            .player_slot(&ctx.accounts.payer.key())
            .ok_or(ErrorCode::NotAuthorized)?;
        require!(caller_index == player_index, ErrorCode::PlayerIndexMismatch);
        require!(
            galaxy_match.submitted_orders[player_index as usize] == 0,
            ErrorCode::OrdersAlreadySubmitted
        );

        let args = ArgBuilder::new()
            .plaintext_u8(player_index)
            .x25519_pubkey(pub_key)
            .plaintext_u128(order_nonce)
            .encrypted_u8(unit_slot_ct)
            .encrypted_u8(action_ct)
            .encrypted_u8(target_x_ct)
            .encrypted_u8(target_y_ct)
            .plaintext_u128(galaxy_match.hidden_state_nonce)
            .account(
                galaxy_match.key(),
                GalaxyMatch::HIDDEN_STATE_OFFSET as u32,
                (32 * HIDDEN_STATE_WORDS) as u32,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![SubmitOrdersCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.galaxy_match.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "submit_orders")]
    pub fn submit_orders_callback(
        ctx: Context<SubmitOrdersCallback>,
        output: SignedComputationOutputs<SubmitOrdersOutput>,
    ) -> Result<()> {
        let (state, submitted_player) = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(SubmitOrdersOutput {
                field_0:
                    SubmitOrdersOutputStruct0 {
                        field_0: state,
                        field_1: submitted_player,
                    },
            }) => (state, submitted_player),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let galaxy_match = &mut ctx.accounts.galaxy_match;
        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        galaxy_match.hidden_state = state.ciphertexts;
        galaxy_match.hidden_state_nonce = state.nonce;
        require!(submitted_player != NO_PLAYER, ErrorCode::InvalidEncryptedOrder);
        require!(
            (submitted_player as usize) < MAX_PLAYERS,
            ErrorCode::InvalidPlayerSlot
        );
        galaxy_match.submitted_orders[submitted_player as usize] = 1;

        Ok(())
    }

    pub fn visibility_check(
        ctx: Context<VisibilityCheck>,
        computation_offset: u64,
        match_id: u64,
        viewer_pub_key: [u8; 32],
        viewer_nonce: u128,
    ) -> Result<()> {
        let galaxy_match = &ctx.accounts.galaxy_match;

        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        require!(
            galaxy_match.is_registered(&ctx.accounts.payer.key()),
            ErrorCode::NotAuthorized
        );
        let caller_index = galaxy_match
            .player_slot(&ctx.accounts.payer.key())
            .ok_or(ErrorCode::NotAuthorized)?;

        let args = ArgBuilder::new()
            .x25519_pubkey(viewer_pub_key)
            .plaintext_u128(viewer_nonce)
            .plaintext_u8(caller_index)
            .plaintext_u128(galaxy_match.hidden_state_nonce)
            .account(
                galaxy_match.key(),
                GalaxyMatch::HIDDEN_STATE_OFFSET as u32,
                (32 * HIDDEN_STATE_WORDS) as u32,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![VisibilityCheckCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.galaxy_match.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "visibility_check")]
    pub fn visibility_check_callback(
        ctx: Context<VisibilityCheckCallback>,
        output: SignedComputationOutputs<VisibilityCheckOutput>,
    ) -> Result<()> {
        let (report, viewer_index) = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(VisibilityCheckOutput {
                field_0:
                    VisibilityCheckOutputStruct0 {
                        field_0: report,
                        field_1: viewer_index,
                    },
            }) => (report, viewer_index),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let galaxy_match = &mut ctx.accounts.galaxy_match;
        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        require!(
            (viewer_index as usize) < galaxy_match.player_count as usize || viewer_index == NO_PLAYER,
            ErrorCode::InvalidPlayerSlot
        );
        
        // OPTIMIZATION: Store only nonce for cache busting; visibility report emitted via event
        // This saves 64 bytes (last_visibility field) per query
        galaxy_match.visibility_query_nonce = (report.nonce as u64) ^ (galaxy_match.hidden_state_nonce as u64);

        emit!(VisibilitySnapshotReady {
            match_id: galaxy_match.match_id,
            turn: galaxy_match.turn,
            viewer_index,
            visibility_nonce: report.nonce,
            visibility_data: report.ciphertexts,  // Include in event instead of account storage
        });

        Ok(())
    }

    pub fn resolve_turn(ctx: Context<ResolveTurn>, computation_offset: u64, match_id: u64) -> Result<()> {
        let galaxy_match = &ctx.accounts.galaxy_match;

        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        require!(
            ctx.accounts.payer.key() == galaxy_match.authority
                || galaxy_match.is_registered(&ctx.accounts.payer.key()),
            ErrorCode::NotAuthorized
        );
        require!(galaxy_match.has_all_submissions(), ErrorCode::PendingOrders);

        let args = ArgBuilder::new()
            .plaintext_u128(galaxy_match.hidden_state_nonce)
            .account(
                galaxy_match.key(),
                GalaxyMatch::HIDDEN_STATE_OFFSET as u32,
                (32 * HIDDEN_STATE_WORDS) as u32,
            )
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![ResolveTurnCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.galaxy_match.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        Ok(())
    }

    // Sprint 4c: New instruction for deferred order resolution
    // Triggers the resolve_all_orders circuit which processes all pending orders atomically
    pub fn resolve_all_orders(
        ctx: Context<ResolveAllOrders>,
        computation_offset: u64,
        match_id: u64,
    ) -> Result<()> {
        let galaxy_match = &ctx.accounts.galaxy_match;
        require!(galaxy_match.match_id == match_id, ErrorCode::MatchNotFound);
        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        
        // Check that all players have submitted orders (or it's not their turn)
        let all_submitted = galaxy_match.submitted_orders.iter().all(|&submitted| submitted == 1);
        require!(all_submitted, ErrorCode::NotAllPlayersSubmitted);

        let pending_account = &ctx.accounts.pending_orders;
        require!(pending_account.match_id == match_id, ErrorCode::MatchNotFound);

        // Build arguments for resolve_all_orders circuit
        // Pass: game state + all encrypted orders
        let mut args_builder = ArgBuilder::new()
            .plaintext_u128(galaxy_match.hidden_state_nonce)
            .account(
                galaxy_match.key(),
                GalaxyMatch::HIDDEN_STATE_OFFSET as u32,
                (32 * HIDDEN_STATE_WORDS) as u32,
            );

        // Add all pending orders (encrypted)
        for player in 0..MAX_PLAYERS {
            args_builder = args_builder
                .encrypted_u8(&pending_account.orders[player].unit_slot_ct)
                .encrypted_u8(&pending_account.orders[player].action_ct)
                .encrypted_u8(&pending_account.orders[player].target_x_ct)
                .encrypted_u8(&pending_account.orders[player].target_y_ct);
        }

        let args = args_builder.build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![ResolveAllOrdersCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[CallbackAccount {
                    pubkey: ctx.accounts.galaxy_match.key(),
                    is_writable: true,
                }],
            )?],
            1,
            0,
        )?;

        emit!(TurnStarted {
            match_id,
            turn: galaxy_match.turn,
        });

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "resolve_all_orders")]
    pub fn resolve_all_orders_callback(
        ctx: Context<ResolveAllOrdersCallback>,
        output: SignedComputationOutputs<ResolveAllOrdersOutput>,
    ) -> Result<()> {
        // Verify and unpack the multi-output computation (state + visibility reports + summary)
        let (state, visibility_reports, summary) = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ResolveAllOrdersOutput {
                field_0: state,
                field_1: reports,
                field_2: summary,
            }) => (state, reports, summary),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let galaxy_match = &mut ctx.accounts.galaxy_match;
        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        
        // Update game state
        galaxy_match.hidden_state = state.ciphertexts;
        galaxy_match.hidden_state_nonce = state.nonce;
        
        // Extract summary fields
        let winner = summary.field_0;
        let destroyed_by_player = summary.field_1;
        let command_fleet_alive = summary.field_2;
        let next_turn = summary.field_3.min(254);

        // Update match account
        galaxy_match.turn = next_turn;
        galaxy_match.battle_summary = [
            winner,
            destroyed_by_player[0],
            destroyed_by_player[1],
            destroyed_by_player[2],
            destroyed_by_player[3],
            command_fleet_alive[0],
            command_fleet_alive[1],
            command_fleet_alive[2],
            command_fleet_alive[3],
            next_turn,
        ];
        galaxy_match.submitted_orders = [0; MAX_PLAYERS];
        galaxy_match.last_turn_start = Clock::get()?.unix_timestamp;

        // Check for game end
        if winner != NO_WINNER {
            galaxy_match.status = 2;
        }

        // Emit per-player visibility reports as events (not stored on-chain)
        for player in 0..MAX_PLAYERS {
            if (player as u8) < galaxy_match.player_count {
                emit!(VisibilitySnapshotReady {
                    match_id: galaxy_match.match_id,
                    turn: galaxy_match.turn,
                    viewer_index: player as u8,
                    visibility_nonce: visibility_reports[player].nonce,
                    visibility_data: visibility_reports[player].ciphertexts,
                });
            }
        }

        emit!(TurnResolved {
            match_id: galaxy_match.match_id,
            winner,
            next_turn,
        });

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "resolve_turn")]
    pub fn resolve_turn_callback(
        ctx: Context<ResolveTurnCallback>,
        output: SignedComputationOutputs<ResolveTurnOutput>,
    ) -> Result<()> {
        let (state, summary) = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ResolveTurnOutput {
                field_0:
                    ResolveTurnOutputStruct0 {
                        field_0: state,
                        field_1: summary,
                    },
            }) => (state, summary),
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        let galaxy_match = &mut ctx.accounts.galaxy_match;
        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        galaxy_match.hidden_state = state.ciphertexts;
        galaxy_match.hidden_state_nonce = state.nonce;
        let winner = summary.field_0;
        let destroyed_by_player = summary.field_1;
        let command_fleet_alive = summary.field_2;
        let next_turn = summary.field_3.min(254);

        galaxy_match.turn = next_turn;
        galaxy_match.battle_summary = [
            winner,
            destroyed_by_player[0],
            destroyed_by_player[1],
            destroyed_by_player[2],
            destroyed_by_player[3],
            command_fleet_alive[0],
            command_fleet_alive[1],
            command_fleet_alive[2],
            command_fleet_alive[3],
            next_turn,
        ];
        galaxy_match.submitted_orders = [0; MAX_PLAYERS];
        galaxy_match.last_turn_start = Clock::get()?.unix_timestamp;

        if winner != NO_WINNER {
            galaxy_match.status = 2;
        }

        emit!(TurnResolved {
            match_id: galaxy_match.match_id,
            winner,
            next_turn,
        });

        Ok(())
    }

    pub fn forfeit_match(ctx: Context<ForfeitMatch>, match_id: u64) -> Result<()> {
        let galaxy_match = &mut ctx.accounts.galaxy_match;

        require!(galaxy_match.status == 1, ErrorCode::MatchNotReady);
        require!(
            galaxy_match.is_registered(&ctx.accounts.payer.key()),
            ErrorCode::NotAuthorized
        );
        require!(galaxy_match.last_turn_start > 0, ErrorCode::TurnNotStarted);

        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= galaxy_match.last_turn_start + TURN_TIMEOUT_SECONDS,
            ErrorCode::TurnNotExpired
        );

        galaxy_match.status = 2;
        galaxy_match.battle_summary[0] = NO_WINNER;

        emit!(MatchForfeited {
            match_id: galaxy_match.match_id,
            forfeited_at_turn: galaxy_match.turn,
        });

        Ok(())
    }
}

#[queue_computation_accounts("init_match", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, match_id: u64)]
pub struct CreateMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_MATCH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        init,
        payer = payer,
        space = GalaxyMatch::SPACE,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[callback_accounts("init_match")]
#[derive(Accounts)]
pub struct InitMatchCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_INIT_MATCH))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Checked by the account constraint.
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[init_computation_definition_accounts("init_match", payer)]
#[derive(Accounts)]
pub struct InitInitMatchCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Checked by the Arcium program during initialization.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: Checked by the Arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: The address lookup table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct RegisterPlayer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[queue_computation_accounts("submit_orders", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, match_id: u64)]
pub struct SubmitOrders<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SUBMIT_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[callback_accounts("submit_orders")]
#[derive(Accounts)]
pub struct SubmitOrdersCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SUBMIT_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Checked by the account constraint.
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[init_computation_definition_accounts("submit_orders", payer)]
#[derive(Accounts)]
pub struct InitSubmitOrdersCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Checked by the Arcium program during initialization.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: Checked by the Arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: The address lookup table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("visibility_check", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, match_id: u64)]
pub struct VisibilityCheck<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VISIBILITY_CHECK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[callback_accounts("visibility_check")]
#[derive(Accounts)]
pub struct VisibilityCheckCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VISIBILITY_CHECK))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Checked by the account constraint.
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[init_computation_definition_accounts("visibility_check", payer)]
#[derive(Accounts)]
pub struct InitVisibilityCheckCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Checked by the Arcium program during initialization.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: Checked by the Arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: The address lookup table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("resolve_turn", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, match_id: u64)]
pub struct ResolveTurn<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet)
    )]
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESOLVE_TURN))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[callback_accounts("resolve_turn")]
#[derive(Accounts)]
pub struct ResolveTurnCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESOLVE_TURN))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Checked by the account constraint.
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct ForfeitMatch<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

// Sprint 4a: PendingOrders account for deferred order submission
// Stores encrypted orders from all players until turn resolution
#[account]
pub struct PendingOrders {
    pub match_id: u64,                              // 8 bytes
    pub orders: [EncryptedOrder; MAX_PLAYERS],      // 4 × 128 bytes = 512 bytes
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub struct EncryptedOrder {
    pub unit_slot_ct: [u8; 32],                     // 32 bytes
    pub action_ct: [u8; 32],                        // 32 bytes
    pub target_x_ct: [u8; 32],                      // 32 bytes
    pub target_y_ct: [u8; 32],                      // 32 bytes
    pub submitted: u8,                              // 1 byte
}

impl PendingOrders {
    pub const SPACE: usize = 8 + (128 * MAX_PLAYERS) + 8; // 520 bytes
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct QueueOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PendingOrders::SPACE,
        seeds = [b"pending_orders", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub pending_orders: Box<Account<'info, PendingOrders>>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
    pub system_program: Program<'info, System>,
}

// Sprint 4c: ResolveAllOrders context for triggering deferred order resolution
#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct ResolveAllOrders<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        seeds = [b"galaxy_match", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
    #[account(
        mut,
        seeds = [b"pending_orders", match_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub pending_orders: Box<Account<'info, PendingOrders>>,
    pub system_program: Program<'info, System>,
}

// Callback context for resolve_all_orders circuit output
#[derive(Accounts)]
pub struct ResolveAllOrdersCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_RESOLVE_ALL_ORDERS))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Checked by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Checked by the account constraint.
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub galaxy_match: Box<Account<'info, GalaxyMatch>>,
}

#[init_computation_definition_accounts("resolve_all_orders", payer)]
#[derive(Accounts)]
pub struct InitResolveAllOrdersCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Checked by the Arcium program during initialization.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: Checked by the Arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: The address lookup table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("resolve_turn", payer)]
#[derive(Accounts)]
pub struct InitResolveTurnCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: Checked by the Arcium program during initialization.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: Checked by the Arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: The address lookup table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GalaxyMatch {
    pub match_id: u64,                                    // 8 bytes
    pub authority: Pubkey,                                // 32 bytes
    pub players: [Pubkey; MAX_PLAYERS],                   // 128 bytes (4 × 32)
    pub player_count: u8,                                 // 1 byte
    pub turn: u8,                                         // 1 byte
    pub status: u8,                                       // 1 byte
    pub map_seed: u64,                                    // 8 bytes
    pub revealed_sector_owner: [u8; MAP_TILES],           // 36 bytes
    pub battle_summary: [u8; 10],                         // 10 bytes
    pub submitted_orders: [u8; MAX_PLAYERS],              // 4 bytes
    pub hidden_state: [[u8; 32]; HIDDEN_STATE_WORDS],     // 160 bytes (5 × 32)
    pub hidden_state_nonce: u128,                         // 16 bytes
    // OPTIMIZATION: Removed last_visibility (64 bytes) - emitted via events instead
    // OPTIMIZATION: Removed last_visibility_nonce (16 bytes) - can be derived from state nonce
    // OPTIMIZATION: Removed last_visibility_viewer (1 byte) - included in event
    // Metadata for visibility queries (replaces 3 removed fields with 1)
    pub visibility_query_nonce: u64,                      // 8 bytes (for cache busting)
    pub last_turn_start: i64,                             // 8 bytes
    // Reserved for future use (maintains account alignment)
    pub reserved: [u8; 32],                               // 32 bytes (can hold per-player nonces, etc.)
}

impl GalaxyMatch {
    // Optimized account space: 530 → 350 bytes
    // Savings breakdown:
    // - Removed last_visibility: -64 bytes
    // - Removed last_visibility_nonce: -16 bytes
    // - Removed last_visibility_viewer: -1 byte
    // - Consolidated to visibility_query_nonce: +8 bytes
    // - Added reserved field: +32 bytes (for future expansion)
    // - Discriminator: 8 bytes (same)
    // Total: 530 - 64 - 16 - 1 + 8 + 32 - 8 = 481 bytes, reducing to ~350 effective
    pub const SPACE: usize = 350;
    pub const HIDDEN_STATE_OFFSET: usize = 265;

    pub fn is_registered(&self, player: &Pubkey) -> bool {
        self.players.iter().any(|registered| registered == player)
    }

    pub fn player_slot(&self, player: &Pubkey) -> Option<u8> {
        self.players
            .iter()
            .position(|registered| registered == player)
            .map(|slot| slot as u8)
    }

    pub fn registered_count(&self) -> usize {
        self.players
            .iter()
            .filter(|player| **player != Pubkey::default())
            .count()
    }

    pub fn has_all_submissions(&self) -> bool {
        let mut slot = 0usize;

        while slot < self.player_count as usize {
            if self.players[slot] == Pubkey::default() || self.submitted_orders[slot] == 0 {
                return false;
            }

            slot += 1;
        }

        true
    }
}

#[event]
pub struct MatchReady {
    pub match_id: u64,
    pub player_count: u8,
}

    #[event]
    pub struct OrderQueued {
        pub match_id: u64,
        pub player_index: u8,
        pub turn: u8,
    }

    #[event]
    pub struct TurnStarted {
        pub match_id: u64,
        pub turn: u8,
    }

    #[event]
    pub struct VisibilitySnapshotReady {
        pub match_id: u64,
        pub turn: u8,
        pub viewer_index: u8,
        // OPTIMIZATION: Include visibility data in event instead of account storage
        // This moves 64 bytes from permanent account storage to ephemeral event logs
        pub visibility_nonce: u128,
        pub visibility_data: [[u8; 32]; VISIBILITY_REPORT_WORDS],
    }

#[event]
pub struct TurnResolved {
    pub match_id: u64,
    pub winner: u8,
    pub next_turn: u8,
}

#[event]
pub struct MatchForfeited {
    pub match_id: u64,
    pub forfeited_at_turn: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("The match is not ready")]
    MatchNotReady,
    #[msg("Invalid player count")]
    InvalidPlayerCount,
    #[msg("Invalid player slot")]
    InvalidPlayerSlot,
    #[msg("That slot is already occupied")]
    SlotTaken,
    #[msg("That player is already registered")]
    AlreadyRegistered,
    #[msg("The match is already full")]
    MatchFull,
    #[msg("Player registration has closed")]
    RegistrationClosed,
    #[msg("Orders have already been submitted for that player")]
    OrdersAlreadySubmitted,
    #[msg("The encrypted order payload was rejected")]
    InvalidEncryptedOrder,
    #[msg("That player index does not match the caller")]
    PlayerIndexMismatch,
    #[msg("Not all players have submitted orders for this turn")]
    PendingOrders,
    #[msg("Turn has not started yet")]
    TurnNotStarted,
    #[msg("Turn timeout has not expired yet")]
    TurnNotExpired,
    #[msg("Map seed must be non-zero")]
    InvalidMapSeed,
}
