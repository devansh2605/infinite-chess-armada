const supabase = require('../lib/supabaseAdmin');
const Game = require('../models/Game');
const updateGame = require('./updateGame');
const timeOut = require('./timeOut');
const resignOrDraw = require('./resignOrDraw');
const engineManager = require('./engineManager');
const logger = require('../logger');
const { buildLobbyState } = require('../routes/lobby');

const gameTokens = {};
const localDrawnBoards = {};

module.exports = io => {
	const lobbySocket = io.of('/lobby');
	const gameSocket = io.of('/game');

	function clearRoom(room, namespace = '/') {
		const ns = io.nsps[namespace];
		if (!ns) return;
		const roomObj = ns.adapter.rooms[room];
		if (roomObj) {
			Object.keys(roomObj.sockets).forEach(id => {
				const sock = ns.connected[id];
				if (sock) sock.leave(room);
			});
		}
	}

	async function verifyToken(token) {
		if (!token) return null;
		const { data: { user }, error } = await supabase.auth.getUser(token);
		if (error || !user) return null;
		return user;
	}

	async function checkIfUserInGame(id, token) {
		try {
			if (!token || !id) return false;
			const row = await Game.getGameWithUsersByID(id);
			if (row.status !== 'playing' && row.status !== 'paused') return false;
			const user = await verifyToken(token);
			if (!user) return false;
			return row.player1.id === user.id || row.player2.id === user.id
				|| row.player3.id === user.id || row.player4.id === user.id;
		} catch { return false; }
	}

	lobbySocket.on('connection', socket => {
		socket.on('join_room', async ({ roomCode, gameId, token }) => {
			const user = await verifyToken(token);
			if (!user) return socket.emit('lobby_error', 'unauthorized');
			const game = await Game.getByID(gameId).catch(() => null);
			if (!game || game.status !== 'lobby' || game.room_code !== roomCode) return socket.emit('lobby_error', 'room_not_found');
			socket.join(roomCode);
			socket.userId = user.id;
			socket.roomCode = roomCode;
			socket.gameId = gameId;
			const state = await buildLobbyState(game);
			socket.emit('lobby_state', state);
			socket.to(roomCode).emit('participant_joined', { userId: user.id });
		});

		socket.on('select_slot', async ({ gameId, slot, isEngine, engineLevel, token }) => {
			const user = await verifyToken(token);
			if (!user) return;
			const game = await Game.getByID(gameId).catch(() => null);
			if (!game || game.status !== 'lobby') return;
			const s = Number(slot);
			const currentHolder = game['player' + s];
			const isCurrentEngine = game.engine_slots && game.engine_slots[s];
			if (currentHolder && currentHolder !== user.id && !isCurrentEngine) return socket.emit('lobby_error', 'slot_taken');
			for (const other of [1, 2, 3, 4]) {
				if (other !== s && game['player' + other] === user.id) await Game.releaseSlot(gameId, other);
			}
			if (isEngine) {
				await Game.setEngineSlot(gameId, s, engineLevel || 5, game);
			} else {
				if (isCurrentEngine) await Game.clearEngineSlot(gameId, s, game);
				await Game.assignSlot(gameId, s, user.id);
			}
			const updated = await Game.getByID(gameId);
			const state = await buildLobbyState(updated);
			lobbySocket.in(socket.roomCode).emit('slot_updated', state);
		});

		socket.on('release_slot', async ({ gameId, slot, token }) => {
			const user = await verifyToken(token);
			if (!user) return;
			const game = await Game.getByID(gameId).catch(() => null);
			if (!game || game.status !== 'lobby') return;
			const s = Number(slot);
			if (game['player' + s] === user.id) {
				await Game.releaseSlot(gameId, s);
				const updated = await Game.getByID(gameId);
				const state = await buildLobbyState(updated);
				lobbySocket.in(socket.roomCode).emit('slot_updated', state);
			}
		});

		socket.on('update_time_control', async ({ gameId, minutes, increment, token }) => {
			const user = await verifyToken(token);
			if (!user) return;
			const game = await Game.getByID(gameId).catch(() => null);
			if (!game || game.status !== 'lobby' || game.creator_id !== user.id) return;
			await Game.updateTimeControl(gameId, Math.min(60, Math.max(1, parseInt(minutes) || 5)), Math.min(60, Math.max(0, parseInt(increment) || 0)));
			const updated = await Game.getByID(gameId);
			const state = await buildLobbyState(updated);
			lobbySocket.in(socket.roomCode).emit('slot_updated', state);
		});

		socket.on('start_game', async ({ gameId, token }) => {
			const user = await verifyToken(token);
			if (!user) return socket.emit('lobby_error', 'unauthorized');
			const game = await Game.getByID(gameId).catch(() => null);
			if (!game || game.status !== 'lobby') return socket.emit('lobby_error', 'invalid_game');
			if (game.creator_id !== user.id) return socket.emit('lobby_error', 'not_creator');
			const allFilled = [1, 2, 3, 4].every(s => game['player' + s] || game.engine_slots && game.engine_slots[s]);
			if (!allFilled) return socket.emit('lobby_error', 'slots_not_filled');
			await Game.snapshotStartRatings(game);
			const engineSlots = game.engine_slots || {};
			const engineLevels = game.engine_levels || {};
			const enginePlayers = {};
			const engineSkillLevels = {};
			for (const s of [1, 2, 3, 4]) {
				if (engineSlots[s]) { enginePlayers[s] = true; engineSkillLevels[s] = engineLevels[s] || 5; }
			}
			if (Object.keys(enginePlayers).length > 0) engineManager.registerGame(gameId, enginePlayers, engineSkillLevels);
			await Game.startGame(gameId);
			lobbySocket.in(socket.roomCode).emit('game_started', { gameId });
		});

		socket.on('disconnect', async () => {
			if (!socket.gameId || !socket.userId) return;
			try {
				const game = await Game.getByID(socket.gameId);
				if (game.status !== 'lobby') return;
				for (const s of [1, 2, 3, 4]) {
					if (game['player' + s] === socket.userId) {
						await Game.releaseSlot(socket.gameId, s);
						const updated = await Game.getByID(socket.gameId);
						const state = await buildLobbyState(updated);
						lobbySocket.in(socket.roomCode).emit('slot_updated', state);
						break;
					}
				}
			} catch { /* ignore */ }
		});
	});

	gameSocket.on('connection', socket => {
		socket.on('room', async (roomData) => {
			const gameId = typeof roomData === 'object' ? roomData.gameId || roomData : roomData;
			const token = typeof roomData === 'object' ? roomData.token : null;
			if (gameId) {
				socket.room = gameId;
				socket.join(gameId);
				if (token) {
					if (!gameTokens[gameId]) gameTokens[gameId] = {};
					const user = await verifyToken(token);
					if (user) gameTokens[gameId][user.id] = token;
				}
				if (engineManager.hasEngines(gameId) && gameTokens[gameId]) {
					setTimeout(() => {
						engineManager.triggerEngineMoves(gameId, socket, gameSocket, clearRoom, updateGame, gameTokens[gameId]);
					}, 1500);
				}
			}
		});

		socket.on('register tokens', data => {
			if (data && data.gameId && data.playerTokens) gameTokens[data.gameId] = data.playerTokens;
		});

		socket.on('update game', async data => {
			if (await checkIfUserInGame(data.id, data.token)) {
				await updateGame(data, socket, gameSocket, clearRoom);
				if (engineManager.hasEngines(data.id) && gameTokens[data.id]) {
					setTimeout(() => engineManager.triggerEngineMoves(data.id, socket, gameSocket, clearRoom, updateGame, gameTokens[data.id]), 300);
				}
			}
		});

		socket.on('time out', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await timeOut(data.id, socket, gameSocket, clearRoom);
		});

		socket.on('offer resign', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await resignOrDraw.offerResign(data, socket);
		});

		socket.on('offer draw', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await resignOrDraw.offerDraw(data, socket);
		});

		socket.on('accept resign', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await resignOrDraw.acceptResign(data, socket, gameSocket, clearRoom);
		});

		socket.on('decline resign', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await resignOrDraw.declineResign(data, socket, gameSocket);
		});

		socket.on('accept draw', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await resignOrDraw.acceptDraw(data, socket, gameSocket, clearRoom);
		});

		socket.on('decline draw', async data => {
			if (await checkIfUserInGame(data.id, data.token)) await resignOrDraw.declineDraw(data, socket, gameSocket);
		});

		socket.on('local resign', async data => {
			try {
				if (!(await checkIfUserInGame(data.id, data.token))) return;
				const game = await Game.getByID(data.id);
				if (game.status !== 'playing') return;
				const termination = (data.userPosition === 1 || data.userPosition === 4) ? 'Team 1 resigned, Team 2 is victorious' : 'Team 2 resigned, Team 1 is victorious';
				engineManager.cleanupGame(data.id);
				delete gameTokens[data.id];
				delete localDrawnBoards[data.id];
				await Game.endGame(game, termination, socket, gameSocket, clearRoom);
			} catch (err) { logger.error('Local resign error: ' + err); }
		});

		socket.on('local offer draw', data => {
			gameSocket.in(socket.room).emit('local draw offered', { boardNum: data.boardNum, offeredBy: data.userPosition });
		});

		socket.on('local accept draw', async data => {
			try {
				if (!(await checkIfUserInGame(data.id, data.token))) return;
				const game = await Game.getByID(data.id);
				if (game.status !== 'playing') return;
				if (!localDrawnBoards[data.id]) localDrawnBoards[data.id] = { 1: false, 2: false };
				localDrawnBoards[data.id][data.boardNum] = true;
				engineManager.setBoardDrawn(data.id, data.boardNum);
				gameSocket.in(socket.room).emit('board drawn', { boardNum: data.boardNum });
				if (localDrawnBoards[data.id][1] && localDrawnBoards[data.id][2]) {
					engineManager.cleanupGame(data.id);
					delete gameTokens[data.id];
					delete localDrawnBoards[data.id];
					await Game.endGame(game, 'Game drawn by agreement', socket, gameSocket, clearRoom);
				}
			} catch (err) { logger.error('Local accept draw error: ' + err); }
		});

		socket.on('local decline draw', data => {
			gameSocket.in(socket.room).emit('local draw declined', { boardNum: data.boardNum });
		});
	});
};
