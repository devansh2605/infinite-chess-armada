const supabase = require('../lib/supabaseAdmin');
const ProfileModel = require('./ProfileModel');
const { computeEloUpdates } = require('../lib/elo');
const logger = require('../logger');

class Game {
	constructor(row) {
		Object.assign(this, row);
	}

	static mapRow(row) {
		return new Game(row);
	}

	static mapRowGameWithUsers(row) {
		// row has player1, player2, player3, player4 as UUIDs
		// and player1_profile, etc. as joined objects from profiles
		return {
			id: row.id,
			status: row.status,
			mode: row.mode,
			minutes: row.minutes,
			increment: row.increment,
			clocks: row.clocks,
			moves: row.moves,
			left_fens: row.left_fens,
			right_fens: row.right_fens,
			left_reserve_white: row.left_reserve_white,
			left_reserve_black: row.left_reserve_black,
			right_reserve_white: row.right_reserve_white,
			right_reserve_black: row.right_reserve_black,
			left_promoted_pieces: row.left_promoted_pieces,
			right_promoted_pieces: row.right_promoted_pieces,
			left_last_move: row.left_last_move,
			right_last_move: row.right_last_move,
			left_color_to_play: row.left_color_to_play,
			right_color_to_play: row.right_color_to_play,
			left_last_time: row.left_last_time,
			right_last_time: row.right_last_time,
			resign_state: row.resign_state,
			draw_state: row.draw_state,
			termination: row.termination,
			engine_slots: row.engine_slots || {},
			engine_levels: row.engine_levels || {},
			player1: row.player1_profile || { id: row.player1, username: 'Engine', rating: 0 },
			player2: row.player2_profile || { id: row.player2, username: 'Engine', rating: 0 },
			player3: row.player3_profile || { id: row.player3, username: 'Engine', rating: 0 },
			player4: row.player4_profile || { id: row.player4, username: 'Engine', rating: 0 },
			player1_rating_start: row.player1_rating_start,
			player2_rating_start: row.player2_rating_start,
			player3_rating_start: row.player3_rating_start,
			player4_rating_start: row.player4_rating_start,
		};
	}

	static async getByID(id) {
		const { data, error } = await supabase
			.from('games')
			.select('*')
			.eq('id', id)
			.single();
		if (error || !data) {
			const err = new Error('Game not found');
			err.status = 401;
			throw err;
		}
		return Game.mapRow(data);
	}

	static async getByRoomCode(roomCode) {
		const { data, error } = await supabase
			.from('games')
			.select('*')
			.eq('room_code', roomCode)
			.eq('status', 'lobby')
			.single();
		if (error || !data) return null;
		return Game.mapRow(data);
	}

	static async getGameWithUsersByID(id) {
		const { data, error } = await supabase
			.from('games')
			.select(`
				*,
				player1_profile:profiles!games_player1_fkey(id, username, rating),
				player2_profile:profiles!games_player2_fkey(id, username, rating),
				player3_profile:profiles!games_player3_fkey(id, username, rating),
				player4_profile:profiles!games_player4_fkey(id, username, rating)
			`)
			.eq('id', id)
			.single();
		if (error || !data) {
			const err = new Error('Game not found');
			err.status = 401;
			throw err;
		}
		return Game.mapRowGameWithUsers(data);
	}

	static async createLobbyGame(creatorId, minutes, increment) {
		// Generate unique room code
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let roomCode, inserted = false;
		let id;

		while (!inserted) {
			roomCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
			id = Math.random().toString(36).substr(2, 12);

			const { error } = await supabase.from('games').insert({
				id,
				room_code: roomCode,
				status: 'lobby',
				mode: 'Rated',
				creator_id: creatorId,
				minutes,
				increment,
				clocks: '0,0,0,0',
				left_fens: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
				right_fens: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
				left_last_move: '[]',
				right_last_move: '[]',
				left_color_to_play: 'white',
				right_color_to_play: 'white',
				resign_state: '0,0,0,0',
				draw_state: '0,0,0,0',
				engine_slots: {},
				engine_levels: {},
			});

			if (!error) inserted = true;
		}

		return { id, roomCode };
	}

	static async assignSlot(gameId, slot, userId) {
		const col = `player${slot}`;
		const { error } = await supabase
			.from('games')
			.update({ [col]: userId })
			.eq('id', gameId);
		if (error) throw new Error(error.message);
	}

	static async releaseSlot(gameId, slot) {
		const col = `player${slot}`;
		const { error } = await supabase
			.from('games')
			.update({ [col]: null })
			.eq('id', gameId);
		if (error) throw new Error(error.message);
	}

	static async setEngineSlot(gameId, slot, level, game) {
		const engineSlots = { ...(game.engine_slots || {}) };
		const engineLevels = { ...(game.engine_levels || {}) };
		engineSlots[slot] = true;
		engineLevels[slot] = level;

		// Clear human assignment for this slot
		const { error } = await supabase
			.from('games')
			.update({ [`player${slot}`]: null, engine_slots: engineSlots, engine_levels: engineLevels })
			.eq('id', gameId);
		if (error) throw new Error(error.message);
	}

	static async clearEngineSlot(gameId, slot, game) {
		const engineSlots = { ...(game.engine_slots || {}) };
		const engineLevels = { ...(game.engine_levels || {}) };
		delete engineSlots[slot];
		delete engineLevels[slot];
		const { error } = await supabase
			.from('games')
			.update({ engine_slots: engineSlots, engine_levels: engineLevels })
			.eq('id', gameId);
		if (error) throw new Error(error.message);
	}

	static async updateTimeControl(gameId, minutes, increment) {
		const { error } = await supabase
			.from('games')
			.update({ minutes, increment })
			.eq('id', gameId);
		if (error) throw new Error(error.message);
	}

	static async snapshotStartRatings(game) {
		const updates = {};
		for (const slot of [1, 2, 3, 4]) {
			const playerId = game[`player${slot}`];
			if (playerId && !game.engine_slots?.[slot]) {
				const profile = await ProfileModel.getByID(playerId);
				updates[`player${slot}_rating_start`] = profile.rating;
			}
		}
		const { error } = await supabase.from('games').update(updates).eq('id', game.id);
		if (error) throw new Error(error.message);
	}

	static async startGame(gameId) {
		const now = Date.now();
		const { error } = await supabase
			.from('games')
			.update({
				status: 'playing',
				room_code: null,
				left_last_time: now,
				right_last_time: now,
			})
			.eq('id', gameId);
		if (error) throw new Error(error.message);
	}

	static async pauseGame(id, clocksArr) {
		const { error } = await supabase
			.from('games')
			.update({ status: 'paused', clocks: clocksArr.join(','), left_last_time: null, right_last_time: null })
			.eq('id', id);
		if (error) throw new Error(error.message);
	}

	static async resumeGame(id) {
		const now = Date.now();
		const { error } = await supabase
			.from('games')
			.update({ status: 'playing', left_last_time: now, right_last_time: now })
			.eq('id', id);
		if (error) throw new Error(error.message);
	}

	static async getPausedGames() {
		const { data, error } = await supabase
			.from('games')
			.select(`
				id, minutes, increment, mode, clocks,
				p1:profiles!games_player1_fkey(username),
				p2:profiles!games_player2_fkey(username),
				p3:profiles!games_player3_fkey(username),
				p4:profiles!games_player4_fkey(username)
			`)
			.eq('status', 'paused')
			.order('created_at', { ascending: false });
		if (error) return [];
		return (data || []).map(r => ({
			...r, p1: r.p1?.username, p2: r.p2?.username, p3: r.p3?.username, p4: r.p4?.username
		}));
	}

	static async getRecentCompleted(limit = 30) {
		const { data, error } = await supabase
			.from('games')
			.select(`
				id, minutes, increment, mode, termination, created_at,
				p1:profiles!games_player1_fkey(username),
				p2:profiles!games_player2_fkey(username),
				p3:profiles!games_player3_fkey(username),
				p4:profiles!games_player4_fkey(username)
			`)
			.eq('status', 'terminated')
			.order('created_at', { ascending: false })
			.limit(limit);
		if (error) return [];
		return (data || []).map(r => ({
			...r, p1: r.p1?.username, p2: r.p2?.username, p3: r.p3?.username, p4: r.p4?.username
		}));
	}

	static async endGame(game, termination, socket, gameSocket, clearRoom) {
		const { error } = await supabase
			.from('games')
			.update({ termination, status: 'terminated' })
			.eq('id', game.id);
		if (error) logger.error(`endGame update error: ${error.message}`);

		let winner = 'draw';
		if (termination.includes('Team 1 is victorious')) winner = 'team1';
		if (termination.includes('Team 2 is victorious')) winner = 'team2';

		// Compute and apply Elo ratings
		let ratingDeltas = null;
		if (game.mode === 'Rated') {
			try {
				ratingDeltas = await Game._applyEloUpdates(game, winner);
			} catch (eloErr) {
				logger.error(`Elo update error: ${eloErr.message}`);
			}
		}

		gameSocket.in(socket.room).emit('game over', { termination, ratingDeltas });
		clearRoom(socket.room, '/game');
	}

	static async _applyEloUpdates(game, winner) {
		// Fetch human player profiles
		const profiles = {};
		for (const slot of [1, 2, 3, 4]) {
			const playerId = game[`player${slot}`];
			const isEngine = game.engine_slots && game.engine_slots[slot];
			if (playerId && !isEngine) {
				profiles[`p${slot}`] = await ProfileModel.getByID(playerId);
			} else {
				profiles[`p${slot}`] = null;
			}
		}

		const updates = computeEloUpdates(profiles, winner);
		const ratingDeltas = {};

		// Persist updates
		for (const [slot, upd] of Object.entries(updates)) {
			await ProfileModel.updateRating(upd.id, upd.newRating);
			await ProfileModel.incrementGamesPlayed(upd.id);
			ratingDeltas[slot] = upd;

			// Insert rating_history row
			const result = winner === 'draw' ? 'draw'
				: ([1, 4].includes(Number(slot)) && winner === 'team1') || ([2, 3].includes(Number(slot)) && winner === 'team2')
					? 'win' : 'loss';

			await supabase.from('rating_history').insert({
				game_id: game.id,
				player_id: upd.id,
				slot: Number(slot),
				rating_before: upd.oldRating,
				rating_after: upd.newRating,
				result,
			});
		}

		return ratingDeltas;
	}
}

module.exports = Game;
