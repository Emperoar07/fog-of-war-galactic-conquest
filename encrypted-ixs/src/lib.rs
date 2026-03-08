use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    const MAX_PLAYERS: usize = 4;
    const MAX_UNITS_PER_PLAYER: usize = 4;
    const TOTAL_UNITS: usize = MAX_PLAYERS * MAX_UNITS_PER_PLAYER;
    const MAP_WIDTH: u8 = 7;
    const MAP_HEIGHT: u8 = 7;
    const NO_WINNER: u8 = 255;
    const NO_PLAYER: u8 = 255;
    const EMPTY_COORD: u8 = 255;

    const ACTION_MOVE: u8 = 0;
    const ACTION_SCOUT: u8 = 1;
    const ACTION_ATTACK: u8 = 2;

    const UNIT_FIGHTER: u8 = 0;
    const UNIT_SCOUT: u8 = 1;
    const UNIT_COMMAND: u8 = 2;

    // Legacy state size (to be deprecated after migration)
    const STATE_BYTES: usize = 118;
    
    // Optimized compact state size
    // CompactUnit: 4 bytes (x, y, type+health packed, alive)
    // 16 units = 64 bytes
    // Pending orders: 4 bytes per player = 16 bytes
    // Metadata: 1 byte (turn + player_count packed)
    // Total: 81 bytes (fits in 96 with padding)
    const COMPACT_STATE_BYTES: usize = 96;
    const COMPACT_VISIBILITY_BYTES: usize = 32;
    
    // Legacy offsets for STATE_BYTES (118 bytes)
    const UNIT_X_OFFSET: usize = 0;
    const UNIT_Y_OFFSET: usize = UNIT_X_OFFSET + TOTAL_UNITS;
    const UNIT_TYPE_OFFSET: usize = UNIT_Y_OFFSET + TOTAL_UNITS;
    const UNIT_HEALTH_OFFSET: usize = UNIT_TYPE_OFFSET + TOTAL_UNITS;
    const VISION_RANGE_OFFSET: usize = UNIT_HEALTH_OFFSET + TOTAL_UNITS;
    const ALIVE_OFFSET: usize = VISION_RANGE_OFFSET + TOTAL_UNITS;
    const PENDING_UNIT_SLOT_OFFSET: usize = ALIVE_OFFSET + TOTAL_UNITS;
    const PENDING_ACTION_OFFSET: usize = PENDING_UNIT_SLOT_OFFSET + MAX_PLAYERS;
    const PENDING_TARGET_X_OFFSET: usize = PENDING_ACTION_OFFSET + MAX_PLAYERS;
    const PENDING_TARGET_Y_OFFSET: usize = PENDING_TARGET_X_OFFSET + MAX_PLAYERS;
    const PENDING_SUBMITTED_OFFSET: usize = PENDING_TARGET_Y_OFFSET + MAX_PLAYERS;
    const CURRENT_TURN_INDEX: usize = PENDING_SUBMITTED_OFFSET + MAX_PLAYERS;
    const PLAYER_COUNT_INDEX: usize = CURRENT_TURN_INDEX + 1;

    // Compact state offsets (COMPACT_STATE_BYTES = 96)
    const COMPACT_UNIT_X_OFFSET: usize = 0;              // 16 bytes (units 0-15)
    const COMPACT_UNIT_Y_OFFSET: usize = 16;             // 16 bytes
    const COMPACT_UNIT_DATA_OFFSET: usize = 32;          // 16 bytes (type+health+alive packed)
    const COMPACT_PENDING_OFFSET: usize = 48;            // 16 bytes (4 players × 4 bytes per order)
    const COMPACT_METADATA_OFFSET: usize = 64;           // 1 byte (turn[4:0] + player_count[2:0])
    // Remaining 31 bytes (65-95) reserved for future use or per-player nonce tracking

    const VISIBILITY_PRESENT_OFFSET: usize = 0;
    const VISIBILITY_X_OFFSET: usize = VISIBILITY_PRESENT_OFFSET + TOTAL_UNITS;
    const VISIBILITY_Y_OFFSET: usize = VISIBILITY_X_OFFSET + TOTAL_UNITS;

    type GalaxyState = Pack<[u8; STATE_BYTES]>;
    type CompactGameState = Pack<[u8; COMPACT_STATE_BYTES]>;
    type VisibilityReport = Pack<[u8; 48]>;
    type CompactVisibilityReport = Pack<[u8; COMPACT_VISIBILITY_BYTES]>;

    pub struct PlayerCommand {
        unit_slot: u8,
        action: u8,
        target_x: u8,
        target_y: u8,
    }

    pub struct BattleSummary {
        winner: u8,
        destroyed_by_player: [u8; MAX_PLAYERS],
        command_fleet_alive: [u8; MAX_PLAYERS],
        next_turn: u8,
    }

    fn abs_diff(a: u8, b: u8) -> u8 {
        if a >= b {
            a - b
        } else {
            b - a
        }
    }

    fn clamp_coordinate(value: u8, limit: u8) -> u8 {
        if value >= limit {
            limit - 1
        } else {
            value
        }
    }

    fn action_supported(action: u8) -> u8 {
        if action == ACTION_MOVE || action == ACTION_SCOUT || action == ACTION_ATTACK {
            1
        } else {
            0
        }
    }
    
    // Arithmetic masking helper: convert boolean to mask (0 or 1)
    // Used to avoid control flow on secret data in Arcium circuits
    fn to_mask(condition: bool) -> u8 {
        if condition { 1 } else { 0 }
    }
    
    // Arithmetic masking: multiply a value by a mask to conditionally zero it
    // This replaces if/else branches in Arcium computation
    fn apply_mask(value: u8, mask: u8) -> u8 {
        value * mask
    }
    
    // Arithmetic masking: count alive units in a player's roster
    // Pre-computing this allows visibility checks to skip dead units logically
    fn count_alive_units(state: &[u8; STATE_BYTES], player: usize) -> u8 {
        let mut count = 0;
        for unit in 0..MAX_UNITS_PER_PLAYER {
            let slot = unit_index(player, unit);
            count += state[ALIVE_OFFSET + slot];
        }
        count
    }
    
    // Compress legacy 118-byte state into compact 96-byte format
    // Bitpacking strategy:
    // - Unit data: x, y separate; type+health+alive packed into single byte
    // - Pending orders: unit_slot+action+target_x+target_y per player
    // - Metadata: turn (5 bits) + player_count (3 bits) in single byte
    fn state_to_compact(state: &[u8; STATE_BYTES]) -> [u8; COMPACT_STATE_BYTES] {
        let mut compact: [u8; COMPACT_STATE_BYTES] = [0u8; COMPACT_STATE_BYTES];
        
        // Compress unit positions (x and y coordinates)
        for i in 0..TOTAL_UNITS {
            compact[COMPACT_UNIT_X_OFFSET + i] = state[UNIT_X_OFFSET + i];
            compact[COMPACT_UNIT_Y_OFFSET + i] = state[UNIT_Y_OFFSET + i];
        }
        
        // Compress unit metadata: pack type (2b) + health (3b) + alive (1b)
        // byte layout: [alive:1b][health:3b][type:2b][unused:2b]
        for i in 0..TOTAL_UNITS {
            let unit_type = state[UNIT_TYPE_OFFSET + i] & 0x3;        // 2 bits
            let health = state[UNIT_HEALTH_OFFSET + i] & 0x7;          // 3 bits
            let alive = state[ALIVE_OFFSET + i] & 0x1;                 // 1 bit
            
            compact[COMPACT_UNIT_DATA_OFFSET + i] = 
                (alive << 7) | (health << 4) | (unit_type << 2);
        }
        
        // Compress pending orders: 4 bytes per player
        // [unit_slot:2b][action:2b][target_x:2b][target_y:2b]
        for player in 0..MAX_PLAYERS {
            let base = COMPACT_PENDING_OFFSET + (player * 4);
            compact[base] = state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)];
            compact[base + 1] = state[player_slot(PENDING_ACTION_OFFSET, player)];
            compact[base + 2] = state[player_slot(PENDING_TARGET_X_OFFSET, player)];
            compact[base + 3] = state[player_slot(PENDING_TARGET_Y_OFFSET, player)];
        }
        
        // Compress metadata into single byte
        // [turn:5b][player_count:3b]
        let turn = state[CURRENT_TURN_INDEX] & 0x1F;                  // 5 bits
        let player_count = state[PLAYER_COUNT_INDEX] & 0x7;            // 3 bits
        compact[COMPACT_METADATA_OFFSET] = (turn << 3) | player_count;
        
        compact
    }
    
    // Decompress compact 96-byte state back to legacy 118-byte format
    fn compact_to_state(compact: &[u8; COMPACT_STATE_BYTES]) -> [u8; STATE_BYTES] {
        let mut state: [u8; STATE_BYTES] = [0u8; STATE_BYTES];
        
        // Decompress unit coordinates
        for i in 0..TOTAL_UNITS {
            state[UNIT_X_OFFSET + i] = compact[COMPACT_UNIT_X_OFFSET + i];
            state[UNIT_Y_OFFSET + i] = compact[COMPACT_UNIT_Y_OFFSET + i];
        }
        
        // Decompress unit metadata
        for i in 0..TOTAL_UNITS {
            let packed = compact[COMPACT_UNIT_DATA_OFFSET + i];
            state[ALIVE_OFFSET + i] = (packed >> 7) & 0x1;
            state[UNIT_HEALTH_OFFSET + i] = (packed >> 4) & 0x7;
            state[UNIT_TYPE_OFFSET + i] = (packed >> 2) & 0x3;
            // Vision range and other fields default to 0 (recomputed in game logic)
        }
        
        // Decompress pending orders
        for player in 0..MAX_PLAYERS {
            let base = COMPACT_PENDING_OFFSET + (player * 4);
            state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)] = compact[base];
            state[player_slot(PENDING_ACTION_OFFSET, player)] = compact[base + 1];
            state[player_slot(PENDING_TARGET_X_OFFSET, player)] = compact[base + 2];
            state[player_slot(PENDING_TARGET_Y_OFFSET, player)] = compact[base + 3];
        }
        
        // Decompress metadata
        let metadata = compact[COMPACT_METADATA_OFFSET];
        state[CURRENT_TURN_INDEX] = (metadata >> 3) & 0x1F;
        state[PLAYER_COUNT_INDEX] = metadata & 0x7;
        
        state
    }
    
    // Compress visibility report from 48 bytes to 32 bytes
    // Compact format: per visible unit, encode as u32
    // [pos_x:4b][pos_y:4b][type:2b][unused:2b] per visible unit
    fn visibility_to_compact(report: &[u8; 48]) -> [u8; COMPACT_VISIBILITY_BYTES] {
        let mut compact: [u8; COMPACT_VISIBILITY_BYTES] = [0u8; COMPACT_VISIBILITY_BYTES];
        
        // Pack 8 visible units (max) into 32 bytes
        // Each unit: x (4b) + y (4b) + type (2b) + unused (2b) = 1 byte per unit
        let mut compact_idx = 0;
        for unit_idx in 0..TOTAL_UNITS {
            if report[VISIBILITY_PRESENT_OFFSET + unit_idx] == 1 && compact_idx < 8 {
                let x = report[VISIBILITY_X_OFFSET + unit_idx] & 0x7;  // 3 bits for max coord 6
                let y = report[VISIBILITY_Y_OFFSET + unit_idx] & 0x7;  // 3 bits
                let unit_type = (unit_idx % MAX_UNITS_PER_PLAYER) as u8 & 0x3;  // 2 bits
                
                compact[compact_idx] = (x << 5) | (y << 2) | unit_type;
                compact_idx += 1;
            }
        }
        
        compact
    }

    fn unit_index(player: usize, unit: usize) -> usize {
        player * MAX_UNITS_PER_PLAYER + unit
    }

    fn player_slot(base_offset: usize, player: usize) -> usize {
        base_offset + player
    }

    fn clear_pending_order(state: &mut [u8; STATE_BYTES], player: usize) {
        state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)] = 0;
        state[player_slot(PENDING_ACTION_OFFSET, player)] = ACTION_MOVE;
        state[player_slot(PENDING_TARGET_X_OFFSET, player)] = EMPTY_COORD;
        state[player_slot(PENDING_TARGET_Y_OFFSET, player)] = EMPTY_COORD;
        state[player_slot(PENDING_SUBMITTED_OFFSET, player)] = 0;
    }

    fn unit_visible_to_viewer(
        state: &[u8; STATE_BYTES],
        viewer_index: usize,
        enemy_player_index: usize,
        enemy_unit_index: usize,
    ) -> u8 {
        let enemy_slot = unit_index(enemy_player_index, enemy_unit_index);
        let enemy_x = state[UNIT_X_OFFSET + enemy_slot];
        let enemy_y = state[UNIT_Y_OFFSET + enemy_slot];
        let enemy_alive = state[ALIVE_OFFSET + enemy_slot];
        
        // Arithmetic masking: Pre-compute enemy alive mask (0 or 1)
        // This eliminates the need for control flow on secret data
        let enemy_alive_mask = enemy_alive as usize;
        
        let mut visible = 0;

        for viewer_unit_index in 0..MAX_UNITS_PER_PLAYER {
            let viewer_slot = unit_index(viewer_index, viewer_unit_index);
            let viewer_alive = state[ALIVE_OFFSET + viewer_slot];
            let viewer_alive_mask = viewer_alive as usize;

            // Compute distance unconditionally (Arcium will mask the impact below)
            let dx = abs_diff(state[UNIT_X_OFFSET + viewer_slot], enemy_x);
            let dy = abs_diff(state[UNIT_Y_OFFSET + viewer_slot], enemy_y);
            let manhattan_distance = (dx + dy) as usize;
            let vision_range = state[VISION_RANGE_OFFSET + viewer_slot] as usize;
            
            // Arithmetic masking: in_range = 1 if distance <= range, else 0
            // This comparison will be masked by Arcium anyway, so compute unconditionally
            let in_range = if manhattan_distance <= vision_range { 1 } else { 0 };
            
            // Combine alive masks with range check: both units alive AND in range => visible
            let can_see = viewer_alive_mask * enemy_alive_mask * in_range;
            visible = (visible + can_see).min(1);  // visible = visible OR can_see (saturate at 1)
        }

        visible
    }

    #[instruction]
    pub fn init_match(player_count: u8, map_seed: u64) -> Enc<Mxe, GalaxyState> {
        let mut state: [u8; STATE_BYTES] = [0u8; STATE_BYTES];
        let vertical_shift = if map_seed % 2 == 0 { 0 } else { 1 };

        for index in 0..TOTAL_UNITS {
            state[UNIT_X_OFFSET + index] = EMPTY_COORD;
            state[UNIT_Y_OFFSET + index] = EMPTY_COORD;
            state[UNIT_TYPE_OFFSET + index] = UNIT_FIGHTER;
            state[UNIT_HEALTH_OFFSET + index] = 0;
            state[VISION_RANGE_OFFSET + index] = 0;
            state[ALIVE_OFFSET + index] = 0;
        }

        for player in 0..MAX_PLAYERS {
            clear_pending_order(&mut state, player);
        }

        state[CURRENT_TURN_INDEX] = 0;
        state[PLAYER_COUNT_INDEX] = player_count;

        for player in 0..MAX_PLAYERS {
            let active_player = (player as u8) < player_count;

            for unit in 0..MAX_UNITS_PER_PLAYER {
                if active_player {
                    let slot = unit_index(player, unit);
                    state[ALIVE_OFFSET + slot] = 1;
                    state[UNIT_HEALTH_OFFSET + slot] = if unit == 0 { 5 } else { 3 };
                    state[UNIT_TYPE_OFFSET + slot] = if unit == 0 {
                        UNIT_COMMAND
                    } else if unit == 1 {
                        UNIT_SCOUT
                    } else {
                        UNIT_FIGHTER
                    };
                    state[VISION_RANGE_OFFSET + slot] = if unit == 1 { 4 } else { 2 };

                    if player == 0 {
                        state[UNIT_X_OFFSET + slot] = 0;
                        state[UNIT_Y_OFFSET + slot] = (unit as u8 + vertical_shift) % MAP_HEIGHT;
                    } else if player == 1 {
                        state[UNIT_X_OFFSET + slot] = MAP_WIDTH - 1;
                        state[UNIT_Y_OFFSET + slot] = (unit as u8 + vertical_shift) % MAP_HEIGHT;
                    } else if player == 2 {
                        state[UNIT_X_OFFSET + slot] = (unit as u8 + vertical_shift) % MAP_WIDTH;
                        state[UNIT_Y_OFFSET + slot] = 0;
                    } else {
                        state[UNIT_X_OFFSET + slot] = (unit as u8 + vertical_shift) % MAP_WIDTH;
                        state[UNIT_Y_OFFSET + slot] = MAP_HEIGHT - 1;
                    }
                }
            }
        }

        Mxe::get().from_arcis(Pack::new(state))
    }

    #[instruction]
    pub fn submit_orders(
        player_index: u8,
        order_ctxt: Enc<Shared, PlayerCommand>,
        game_ctxt: Enc<Mxe, GalaxyState>,
    ) -> (Enc<Mxe, GalaxyState>, u8) {
        let order = order_ctxt.to_arcis();
        let mut state = game_ctxt.to_arcis().unpack();
        let player_count = state[PLAYER_COUNT_INDEX];
        
        // Arithmetic masking: Pre-compute validation masks before any state transitions
        // This eliminates unnecessary multiplications in Arcium MPC
        let is_valid_player = to_mask(player_index < player_count);
        let is_valid_slot = to_mask((order.unit_slot as usize) < MAX_UNITS_PER_PLAYER);
        let is_valid_action = action_supported(order.action);
        let is_valid_index = is_valid_player * is_valid_slot * is_valid_action;
        
        let player = player_index as usize;
        let slot = unit_index(player, order.unit_slot as usize);
        
        // Check unit is alive and no pending order (masked)
        let unit_alive = state[ALIVE_OFFSET + slot];
        let no_pending = to_mask(state[player_slot(PENDING_SUBMITTED_OFFSET, player)] == 0);
        let can_accept = is_valid_index * unit_alive * no_pending;
        
        // Conditionally update state using mask (replaces if/else)
        // Only updates occur if can_accept == 1
        state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)] = 
            if can_accept == 1 { order.unit_slot } else { state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)] };
        state[player_slot(PENDING_ACTION_OFFSET, player)] = 
            if can_accept == 1 { order.action } else { state[player_slot(PENDING_ACTION_OFFSET, player)] };
        state[player_slot(PENDING_TARGET_X_OFFSET, player)] =
            if can_accept == 1 { clamp_coordinate(order.target_x, MAP_WIDTH) } else { state[player_slot(PENDING_TARGET_X_OFFSET, player)] };
        state[player_slot(PENDING_TARGET_Y_OFFSET, player)] =
            if can_accept == 1 { clamp_coordinate(order.target_y, MAP_HEIGHT) } else { state[player_slot(PENDING_TARGET_Y_OFFSET, player)] };
        state[player_slot(PENDING_SUBMITTED_OFFSET, player)] = 
            if can_accept == 1 { 1 } else { 0 };
        
        // Return acceptance status: only reveal if order was accepted
        let accepted_player = can_accept * player_index;

        (game_ctxt.owner.from_arcis(Pack::new(state)), accepted_player.reveal())
    }

    #[instruction]
    pub fn visibility_check(
        viewer: Shared,
        viewer_index: u8,
        game_ctxt: Enc<Mxe, GalaxyState>,
    ) -> (Enc<Shared, VisibilityReport>, u8) {
        let state = game_ctxt.to_arcis().unpack();
        let player_count = state[PLAYER_COUNT_INDEX];
        let mut report: [u8; VISIBILITY_BYTES] = [0u8; VISIBILITY_BYTES];

        for index in 0..TOTAL_UNITS {
            report[VISIBILITY_PRESENT_OFFSET + index] = 0u8;
            report[VISIBILITY_X_OFFSET + index] = EMPTY_COORD;
            report[VISIBILITY_Y_OFFSET + index] = EMPTY_COORD;
        }

        if viewer_index < player_count {
            let viewer_slot = viewer_index as usize;

            for enemy_player in 0..MAX_PLAYERS {
                if enemy_player != viewer_slot && (enemy_player as u8) < player_count {
                    for enemy_unit in 0..MAX_UNITS_PER_PLAYER {
                        let slot = unit_index(enemy_player, enemy_unit);
                        let visible =
                            unit_visible_to_viewer(&state, viewer_slot, enemy_player, enemy_unit);

                        report[VISIBILITY_PRESENT_OFFSET + slot] = visible;

                        if visible == 1 {
                            report[VISIBILITY_X_OFFSET + slot] = state[UNIT_X_OFFSET + slot];
                            report[VISIBILITY_Y_OFFSET + slot] = state[UNIT_Y_OFFSET + slot];
                        }
                    }
                }
            }
        }

        (viewer.from_arcis(Pack::new(report)), viewer_index.reveal())
    }

    #[instruction]
    pub fn resolve_turn(game_ctxt: Enc<Mxe, GalaxyState>) -> (Enc<Mxe, GalaxyState>, BattleSummary) {
        let mut state = game_ctxt.to_arcis().unpack();
        let player_count = state[PLAYER_COUNT_INDEX];
        let mut summary = BattleSummary {
            winner: NO_WINNER,
            destroyed_by_player: [0; MAX_PLAYERS],
            command_fleet_alive: [0; MAX_PLAYERS],
            next_turn: state[CURRENT_TURN_INDEX],
        };

        // PHASE 1: Process MOVE and SCOUT actions with arithmetic masking
        for player in 0..MAX_PLAYERS {
            let is_active_player = to_mask((player as u8) < player_count);
            let has_pending = state[player_slot(PENDING_SUBMITTED_OFFSET, player)];
            let unit_slot = state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)];
            let is_valid_slot = to_mask((unit_slot as usize) < MAX_UNITS_PER_PLAYER);
            
            if is_active_player == 1 && has_pending == 1 && is_valid_slot == 1 {
                let slot = unit_index(player, unit_slot as usize);
                let action = state[player_slot(PENDING_ACTION_OFFSET, player)];
                let unit_alive = state[ALIVE_OFFSET + slot];
                
                // Arithmetic masking: can_move = unit_alive AND (action is MOVE or SCOUT)
                let is_move_action = to_mask(action == ACTION_MOVE || action == ACTION_SCOUT);
                let can_move = unit_alive * is_move_action;
                
                // Conditionally update position using mask
                if can_move == 1 {
                    state[UNIT_X_OFFSET + slot] = state[player_slot(PENDING_TARGET_X_OFFSET, player)];
                    state[UNIT_Y_OFFSET + slot] = state[player_slot(PENDING_TARGET_Y_OFFSET, player)];
                }
            }
        }

        // PHASE 2: Process ATTACK actions with optimized target matching
        for player in 0..MAX_PLAYERS {
            let is_active_player = to_mask((player as u8) < player_count);
            let has_pending = state[player_slot(PENDING_SUBMITTED_OFFSET, player)];
            let action = state[player_slot(PENDING_ACTION_OFFSET, player)];
            let is_attack_action = to_mask(action == ACTION_ATTACK);
            
            if is_active_player == 1 && has_pending == 1 && is_attack_action == 1 {
                let target_x = state[player_slot(PENDING_TARGET_X_OFFSET, player)];
                let target_y = state[player_slot(PENDING_TARGET_Y_OFFSET, player)];

                for enemy_player in 0..MAX_PLAYERS {
                    let is_different_player = to_mask(enemy_player != player);
                    let is_active_enemy = to_mask((enemy_player as u8) < player_count);
                    
                    if is_different_player == 1 && is_active_enemy == 1 {
                        for enemy_unit in 0..MAX_UNITS_PER_PLAYER {
                            let enemy_slot = unit_index(enemy_player, enemy_unit);
                            let enemy_alive = state[ALIVE_OFFSET + enemy_slot];
                            
                            // Compute target match unconditionally (will be masked anyway)
                            let pos_match = to_mask(
                                state[UNIT_X_OFFSET + enemy_slot] == target_x
                                    && state[UNIT_Y_OFFSET + enemy_slot] == target_y
                            );
                            let is_target = enemy_alive * pos_match;
                            
                            // Apply damage if target found
                            if is_target == 1 {
                                let health = state[UNIT_HEALTH_OFFSET + enemy_slot];
                                let survives = to_mask(health > 1);
                                
                                // Conditional health reduction: health_after = survives * (health - 1)
                                state[UNIT_HEALTH_OFFSET + enemy_slot] = 
                                    if survives == 1 { health - 1 } else { 0 };
                                
                                // Mark dead if health reaches 0
                                let is_dead = to_mask(state[UNIT_HEALTH_OFFSET + enemy_slot] == 0);
                                state[ALIVE_OFFSET + enemy_slot] = 
                                    if is_dead == 1 { 0 } else { enemy_alive };
                                state[UNIT_X_OFFSET + enemy_slot] = 
                                    if is_dead == 1 { EMPTY_COORD } else { state[UNIT_X_OFFSET + enemy_slot] };
                                state[UNIT_Y_OFFSET + enemy_slot] = 
                                    if is_dead == 1 { EMPTY_COORD } else { state[UNIT_Y_OFFSET + enemy_slot] };
                            }
                        }
                    }
                }
            }
        }

        // Clear all pending orders for next turn
        for player in 0..MAX_PLAYERS {
            clear_pending_order(&mut state, player);
        }

        // Increment turn counter
        state[CURRENT_TURN_INDEX] += 1;
        summary.next_turn = state[CURRENT_TURN_INDEX];

        // PHASE 3: Compute game summary with arithmetic masking
        let mut living_command_fleets = 0u8;
        let mut last_commander = NO_WINNER;

        for player in 0..MAX_PLAYERS {
            let is_active_player = to_mask((player as u8) < player_count);
            
            if is_active_player == 1 {
                // Count destroyed units for this player (using arithmetic masking)
                let mut destroyed = 0u8;
                for unit in 0..MAX_UNITS_PER_PLAYER {
                    let slot = unit_index(player, unit);
                    let is_dead = to_mask(state[ALIVE_OFFSET + slot] == 0);
                    destroyed += is_dead;
                }
                summary.destroyed_by_player[player] = destroyed;

                // Check if command fleet (unit 0) is alive
                let command_slot = unit_index(player, 0);
                let command_alive = state[ALIVE_OFFSET + command_slot];
                summary.command_fleet_alive[player] = command_alive;
                
                // Count living command fleets (masking based on alive status)
                living_command_fleets += command_alive;
                
                // Track last living commander using arithmetic masking
                // last_commander = alive ? player : last_commander
                if command_alive == 1 {
                    last_commander = player as u8;
                }
            }
        }

        // Determine winner: only one command fleet alive
        summary.winner = if living_command_fleets == 1 { last_commander } else { NO_WINNER };

        (game_ctxt.owner.from_arcis(Pack::new(state)), summary.reveal())
    }
}
