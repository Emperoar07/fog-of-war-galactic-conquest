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

    const STATE_BYTES: usize = 118;
    const VISIBILITY_BYTES: usize = 48;

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

    const VISIBILITY_PRESENT_OFFSET: usize = 0;
    const VISIBILITY_X_OFFSET: usize = VISIBILITY_PRESENT_OFFSET + TOTAL_UNITS;
    const VISIBILITY_Y_OFFSET: usize = VISIBILITY_X_OFFSET + TOTAL_UNITS;

    type GalaxyState = Pack<[u8; STATE_BYTES]>;
    type VisibilityReport = Pack<[u8; VISIBILITY_BYTES]>;

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
        let mut visible = 0;

        for viewer_unit_index in 0..MAX_UNITS_PER_PLAYER {
            let viewer_slot = unit_index(viewer_index, viewer_unit_index);

            if state[ALIVE_OFFSET + viewer_slot] == 1 && enemy_alive == 1 {
                let dx = abs_diff(state[UNIT_X_OFFSET + viewer_slot], enemy_x);
                let dy = abs_diff(state[UNIT_Y_OFFSET + viewer_slot], enemy_y);

                if dx + dy <= state[VISION_RANGE_OFFSET + viewer_slot] {
                    visible = 1;
                }
            }
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
        let mut accepted_player = NO_PLAYER;

        if player_index < player_count
            && order.unit_slot < MAX_UNITS_PER_PLAYER as u8
            && action_supported(order.action) == 1
        {
            let player = player_index as usize;
            let slot = unit_index(player, order.unit_slot as usize);

            if state[ALIVE_OFFSET + slot] == 1 && state[player_slot(PENDING_SUBMITTED_OFFSET, player)] == 0 {
                state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)] = order.unit_slot;
                state[player_slot(PENDING_ACTION_OFFSET, player)] = order.action;
                state[player_slot(PENDING_TARGET_X_OFFSET, player)] =
                    clamp_coordinate(order.target_x, MAP_WIDTH);
                state[player_slot(PENDING_TARGET_Y_OFFSET, player)] =
                    clamp_coordinate(order.target_y, MAP_HEIGHT);
                state[player_slot(PENDING_SUBMITTED_OFFSET, player)] = 1;
                accepted_player = player_index;
            }
        }

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

        for player in 0..MAX_PLAYERS {
            if (player as u8) < player_count && state[player_slot(PENDING_SUBMITTED_OFFSET, player)] == 1 {
                let unit_slot = state[player_slot(PENDING_UNIT_SLOT_OFFSET, player)];

                if unit_slot < MAX_UNITS_PER_PLAYER as u8 {
                    let slot = unit_index(player, unit_slot as usize);
                    let action = state[player_slot(PENDING_ACTION_OFFSET, player)];

                    if state[ALIVE_OFFSET + slot] == 1
                        && (action == ACTION_MOVE || action == ACTION_SCOUT)
                    {
                        state[UNIT_X_OFFSET + slot] = state[player_slot(PENDING_TARGET_X_OFFSET, player)];
                        state[UNIT_Y_OFFSET + slot] = state[player_slot(PENDING_TARGET_Y_OFFSET, player)];
                    }
                }
            }
        }

        for player in 0..MAX_PLAYERS {
            if (player as u8) < player_count
                && state[player_slot(PENDING_SUBMITTED_OFFSET, player)] == 1
                && state[player_slot(PENDING_ACTION_OFFSET, player)] == ACTION_ATTACK
            {
                let target_x = state[player_slot(PENDING_TARGET_X_OFFSET, player)];
                let target_y = state[player_slot(PENDING_TARGET_Y_OFFSET, player)];

                for enemy_player in 0..MAX_PLAYERS {
                    if enemy_player != player && (enemy_player as u8) < player_count {
                        for enemy_unit in 0..MAX_UNITS_PER_PLAYER {
                            let enemy_slot = unit_index(enemy_player, enemy_unit);

                            if state[ALIVE_OFFSET + enemy_slot] == 1
                                && state[UNIT_X_OFFSET + enemy_slot] == target_x
                                && state[UNIT_Y_OFFSET + enemy_slot] == target_y
                            {
                                if state[UNIT_HEALTH_OFFSET + enemy_slot] > 1 {
                                    state[UNIT_HEALTH_OFFSET + enemy_slot] -= 1;
                                } else {
                                    state[UNIT_HEALTH_OFFSET + enemy_slot] = 0;
                                    state[ALIVE_OFFSET + enemy_slot] = 0;
                                    state[UNIT_X_OFFSET + enemy_slot] = EMPTY_COORD;
                                    state[UNIT_Y_OFFSET + enemy_slot] = EMPTY_COORD;
                                }
                            }
                        }
                    }
                }
            }
        }

        for player in 0..MAX_PLAYERS {
            clear_pending_order(&mut state, player);
        }

        state[CURRENT_TURN_INDEX] += 1;
        summary.next_turn = state[CURRENT_TURN_INDEX];

        let mut living_command_fleets = 0u8;
        let mut last_commander = NO_WINNER;

        for player in 0..MAX_PLAYERS {
            if (player as u8) < player_count {
                for unit in 0..MAX_UNITS_PER_PLAYER {
                    let slot = unit_index(player, unit);

                    if state[ALIVE_OFFSET + slot] == 0 {
                        summary.destroyed_by_player[player] += 1;
                    }
                }

                if state[ALIVE_OFFSET + unit_index(player, 0)] == 1 {
                    summary.command_fleet_alive[player] = 1;
                    living_command_fleets += 1;
                    last_commander = player as u8;
                }
            }
        }

        if living_command_fleets == 1 {
            summary.winner = last_commander;
        }

        (game_ctxt.owner.from_arcis(Pack::new(state)), summary.reveal())
    }
}
