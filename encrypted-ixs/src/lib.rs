use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    const MAX_PLAYERS: usize = 4;
    const MAX_UNITS_PER_PLAYER: usize = 4;
    const MAP_WIDTH: u8 = 8;
    const MAP_HEIGHT: u8 = 8;
    const NO_WINNER: u8 = 255;
    const EMPTY_COORD: u8 = 255;

    const ACTION_MOVE: u8 = 0;
    const ACTION_SCOUT: u8 = 1;
    const ACTION_ATTACK: u8 = 2;
    const ACTION_DEFEND: u8 = 3;
    const ACTION_COLONIZE: u8 = 4;

    const UNIT_FIGHTER: u8 = 0;
    const UNIT_SCOUT: u8 = 1;
    const UNIT_COMMAND: u8 = 2;

    pub struct GalaxyState {
        unit_x: [[u8; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
        unit_y: [[u8; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
        unit_type: [[u8; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
        unit_health: [[u8; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
        vision_range: [[u8; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
        alive: [[u8; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
        current_turn: u8,
        player_count: u8,
    }

    pub struct PlayerOrder {
        player_index: u8,
        unit_slot: u8,
        action: u8,
        target_x: u8,
        target_y: u8,
    }

    pub struct VisibilityReport {
        visible_enemy_present: [u8; MAX_PLAYERS * MAX_UNITS_PER_PLAYER],
        visible_enemy_x: [u8; MAX_PLAYERS * MAX_UNITS_PER_PLAYER],
        visible_enemy_y: [u8; MAX_PLAYERS * MAX_UNITS_PER_PLAYER],
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

    fn unit_visible_to_viewer(
        state: &GalaxyState,
        viewer_index: usize,
        enemy_player_index: usize,
        enemy_unit_index: usize,
    ) -> u8 {
        let mut viewer_unit_index = 0usize;

        while viewer_unit_index < MAX_UNITS_PER_PLAYER {
            if state.alive[viewer_index][viewer_unit_index] == 1
                && state.alive[enemy_player_index][enemy_unit_index] == 1
            {
                let dx = abs_diff(
                    state.unit_x[viewer_index][viewer_unit_index],
                    state.unit_x[enemy_player_index][enemy_unit_index],
                );
                let dy = abs_diff(
                    state.unit_y[viewer_index][viewer_unit_index],
                    state.unit_y[enemy_player_index][enemy_unit_index],
                );

                if dx + dy <= state.vision_range[viewer_index][viewer_unit_index] {
                    return 1;
                }
            }

            viewer_unit_index += 1;
        }

        0
    }

    #[instruction]
    pub fn init_match(player_count: u8, map_seed: u64) -> Enc<Mxe, GalaxyState> {
        let mut state = GalaxyState {
            unit_x: [[EMPTY_COORD; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
            unit_y: [[EMPTY_COORD; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
            unit_type: [[UNIT_FIGHTER; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
            unit_health: [[0; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
            vision_range: [[0; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
            alive: [[0; MAX_UNITS_PER_PLAYER]; MAX_PLAYERS],
            current_turn: 0,
            player_count,
        };

        let vertical_shift = (map_seed as u8) & 1;
        let mut player = 0usize;

        while player < MAX_PLAYERS {
            let active_player = (player as u8) < player_count;
            let mut unit = 0usize;

            while unit < MAX_UNITS_PER_PLAYER {
                if active_player {
                    state.alive[player][unit] = 1;
                    state.unit_health[player][unit] = if unit == 0 { 5 } else { 3 };
                    state.unit_type[player][unit] = if unit == 0 {
                        UNIT_COMMAND
                    } else if unit == 1 {
                        UNIT_SCOUT
                    } else {
                        UNIT_FIGHTER
                    };
                    state.vision_range[player][unit] = if unit == 1 { 4 } else { 2 };

                    if player == 0 {
                        state.unit_x[player][unit] = 0;
                        state.unit_y[player][unit] = (unit as u8 + vertical_shift) % MAP_HEIGHT;
                    } else if player == 1 {
                        state.unit_x[player][unit] = MAP_WIDTH - 1;
                        state.unit_y[player][unit] = (unit as u8 + vertical_shift) % MAP_HEIGHT;
                    } else if player == 2 {
                        state.unit_x[player][unit] = (unit as u8 + vertical_shift) % MAP_WIDTH;
                        state.unit_y[player][unit] = 0;
                    } else {
                        state.unit_x[player][unit] = (unit as u8 + vertical_shift) % MAP_WIDTH;
                        state.unit_y[player][unit] = MAP_HEIGHT - 1;
                    }
                }

                unit += 1;
            }

            player += 1;
        }

        Mxe::get().from_arcis(state)
    }

    #[instruction]
    pub fn submit_orders(
        order_ctxt: Enc<Shared, PlayerOrder>,
        game_ctxt: Enc<Mxe, GalaxyState>,
    ) -> Enc<Mxe, GalaxyState> {
        let order = order_ctxt.to_arcis();
        let mut state = game_ctxt.to_arcis();

        if order.player_index < state.player_count && order.unit_slot < MAX_UNITS_PER_PLAYER as u8 {
            let player = order.player_index as usize;
            let unit = order.unit_slot as usize;

            if state.alive[player][unit] == 1 {
                let target_x = clamp_coordinate(order.target_x, MAP_WIDTH);
                let target_y = clamp_coordinate(order.target_y, MAP_HEIGHT);

                if order.action == ACTION_MOVE || order.action == ACTION_SCOUT {
                    state.unit_x[player][unit] = target_x;
                    state.unit_y[player][unit] = target_y;
                } else if order.action == ACTION_ATTACK {
                    let mut enemy_player = 0usize;

                    while enemy_player < MAX_PLAYERS {
                        if enemy_player != player {
                            let mut enemy_unit = 0usize;

                            while enemy_unit < MAX_UNITS_PER_PLAYER {
                                if state.alive[enemy_player][enemy_unit] == 1
                                    && state.unit_x[enemy_player][enemy_unit] == target_x
                                    && state.unit_y[enemy_player][enemy_unit] == target_y
                                {
                                    if state.unit_health[enemy_player][enemy_unit] > 1 {
                                        state.unit_health[enemy_player][enemy_unit] -= 1;
                                    } else {
                                        state.unit_health[enemy_player][enemy_unit] = 0;
                                        state.alive[enemy_player][enemy_unit] = 0;
                                        state.unit_x[enemy_player][enemy_unit] = EMPTY_COORD;
                                        state.unit_y[enemy_player][enemy_unit] = EMPTY_COORD;
                                    }
                                }

                                enemy_unit += 1;
                            }
                        }

                        enemy_player += 1;
                    }
                } else if order.action == ACTION_DEFEND || order.action == ACTION_COLONIZE {
                    // Reserved actions for the MVP.
                }
            }
        }

        game_ctxt.owner.from_arcis(state)
    }

    #[instruction]
    pub fn visibility_check(
        viewer_index: u8,
        game_ctxt: Enc<Mxe, GalaxyState>,
    ) -> Enc<Shared, VisibilityReport> {
        let state = game_ctxt.to_arcis();
        let mut report = VisibilityReport {
            visible_enemy_present: [0; MAX_PLAYERS * MAX_UNITS_PER_PLAYER],
            visible_enemy_x: [EMPTY_COORD; MAX_PLAYERS * MAX_UNITS_PER_PLAYER],
            visible_enemy_y: [EMPTY_COORD; MAX_PLAYERS * MAX_UNITS_PER_PLAYER],
        };

        if viewer_index < state.player_count {
            let viewer = viewer_index as usize;
            let mut enemy_player = 0usize;

            while enemy_player < MAX_PLAYERS {
                if enemy_player != viewer && (enemy_player as u8) < state.player_count {
                    let mut enemy_unit = 0usize;

                    while enemy_unit < MAX_UNITS_PER_PLAYER {
                        let slot = enemy_player * MAX_UNITS_PER_PLAYER + enemy_unit;
                        let visible =
                            unit_visible_to_viewer(&state, viewer, enemy_player, enemy_unit);

                        report.visible_enemy_present[slot] = visible;

                        if visible == 1 {
                            report.visible_enemy_x[slot] = state.unit_x[enemy_player][enemy_unit];
                            report.visible_enemy_y[slot] = state.unit_y[enemy_player][enemy_unit];
                        }

                        enemy_unit += 1;
                    }
                }

                enemy_player += 1;
            }
        }

        Shared::get().from_arcis(report)
    }

    #[instruction]
    pub fn resolve_turn(game_ctxt: Enc<Mxe, GalaxyState>) -> BattleSummary {
        let state = game_ctxt.to_arcis();
        let mut summary = BattleSummary {
            winner: NO_WINNER,
            destroyed_by_player: [0; MAX_PLAYERS],
            command_fleet_alive: [0; MAX_PLAYERS],
            next_turn: state.current_turn + 1,
        };

        let mut player = 0usize;
        let mut living_command_fleets = 0u8;
        let mut last_commander = NO_WINNER;

        while player < MAX_PLAYERS {
            if (player as u8) < state.player_count {
                let mut unit = 0usize;

                while unit < MAX_UNITS_PER_PLAYER {
                    if state.alive[player][unit] == 0 {
                        summary.destroyed_by_player[player] += 1;
                    }

                    unit += 1;
                }

                if state.alive[player][0] == 1 {
                    summary.command_fleet_alive[player] = 1;
                    living_command_fleets += 1;
                    last_commander = player as u8;
                }
            }

            player += 1;
        }

        if living_command_fleets == 1 {
            summary.winner = last_commander;
        }

        summary.reveal()
    }
}
