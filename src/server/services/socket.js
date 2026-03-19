const jwt = require('jsonwebtoken');
const Game = require('../models/Game');
const updateGame = require('./updateGame');
const timeOut = require('./timeOut');
const resignOrDraw = require('./resignOrDraw');
const secretToken = require('../config').secretToken;
const engineManager = require('./engineManager');
const logger = require('../logger');

// In-memory store for player tokens per game (for engine moves)
const gameTokens = {};

// In-memory store for drawn boards per game (for local draw)
const localDrawnBoards = {};

module.exports = io => {
	const lobbySocket = io.of('/lobby');
	const loadingSocket = io.of('/loading');
	const gameSocket = io.of('/game');

	function clearRoom(room, namespace = '/') {
		const roomObj = io.nsps[namespace].adapter.rooms[room];
		if (roomObj) {
			Object.keys(roomObj.sockets).forEach(id => {
				io.nsps[namespace].connected[id].leave(room);
			});
		}
	}

	async function checkIfUserInGame(id, token) {
		try {
			if (!token || !id) return false;
			const row = await Game.getGameWithUsersByID(id);
			if (row.status !== 'playing' && row.status !== 'paused') {
				return false;
			}
			const decoded = jwt.verify(token, secretToken);
			return row.player1.id === decoded.id || row.player2.id === decoded.id || row.player3.id === decoded.id || row.player4.id === decoded.id;
		} catch (err) {
			return false;
		}
	}

	lobbySocket.on('connection', socket => {
		socket.on('update game list', () => {
			socket.broadcast.emit('update game list');
		});
	});

	loadingSocket.on('connection', socket => {
		socket.on('room', async room => {
			if (room) {
				socket.join(room);
				const gameStarted = await Game.tryToStartGame(room);
				if (gameStarted) {
					loadingSocket.in(room).emit('start game', room);
					clearRoom(room, '/loading');
				}
			}
		});
	});

	gameSocket.on('connection', socket => {
		socket.on('room', room => {
			if (room) {
				socket.room = room;
				socket.join(room);
				// Trigger engine moves for the initial position if engines are registered
				if (engineManager.hasEngines(room) && gameTokens[room]) {
					setTimeout(() => {
						engineManager.triggerEngineMoves(room, socket, gameSocket, clearRoom, updateGame, gameTokens[room]);
					}, 1500);
				}
			}
		});

		socket.on('register tokens', data => {
			if (data && data.gameId && data.playerTokens) {
				gameTokens[data.gameId] = data.playerTokens;
			}
		});

		socket.on('update game', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await updateGame(data, socket, gameSocket, clearRoom);
				// After human move, trigger engine moves if applicable
				if (engineManager.hasEngines(data.id) && gameTokens[data.id]) {
					setTimeout(() => {
						engineManager.triggerEngineMoves(data.id, socket, gameSocket, clearRoom, updateGame, gameTokens[data.id]);
					}, 300);
				}
			}
		});
		socket.on('time out', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await timeOut(data.id, socket, gameSocket, clearRoom);
			}
		});
		socket.on('offer resign', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await resignOrDraw.offerResign(data, socket);
			}
		});
		socket.on('offer draw', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await resignOrDraw.offerDraw(data, socket);
			}
		});
		socket.on('accept resign', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await resignOrDraw.acceptResign(data, socket, gameSocket, clearRoom);
			}
		});
		socket.on('decline resign', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await resignOrDraw.declineResign(data, socket, gameSocket);
			}
		});
		socket.on('accept draw', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await resignOrDraw.acceptDraw(data, socket, gameSocket, clearRoom);
			}
		});
		socket.on('decline draw', async data => {
			const userInGame = await checkIfUserInGame(data.id, data.token);
			if (userInGame) {
				await resignOrDraw.declineDraw(data, socket, gameSocket);
			}
		});

		// Local game: immediate resign (ends both boards)
		socket.on('local resign', async data => {
			try {
				const userInGame = await checkIfUserInGame(data.id, data.token);
				if (!userInGame) return;
				const game = await Game.getByID(data.id);
				if (game.status !== 'playing') return;
				let termination;
				if (data.userPosition === 1 || data.userPosition === 4) {
					termination = 'Team 1 resigned, Team 2 is victorious';
				} else {
					termination = 'Team 2 resigned, Team 1 is victorious';
				}
				engineManager.cleanupGame(data.id);
				delete gameTokens[data.id];
				delete localDrawnBoards[data.id];
				await Game.endGame(game, termination, socket, gameSocket, clearRoom);
			} catch (err) {
				logger.error(`Local resign error: ${err}`);
			}
		});

		// Local game: offer draw on a specific board
		socket.on('local offer draw', data => {
			// Relay draw offer to all clients so the opponent can accept/decline
			gameSocket.in(socket.room).emit('local draw offered', {
				boardNum: data.boardNum,
				offeredBy: data.userPosition
			});
		});

		// Local game: accept draw on a specific board
		socket.on('local accept draw', async data => {
			try {
				const userInGame = await checkIfUserInGame(data.id, data.token);
				if (!userInGame) return;
				const game = await Game.getByID(data.id);
				if (game.status !== 'playing') return;
				const boardNum = data.boardNum;

				// Track drawn boards
				if (!localDrawnBoards[data.id]) {
					localDrawnBoards[data.id] = { 1: false, 2: false };
				}
				localDrawnBoards[data.id][boardNum] = true;

				// Mark board as drawn in engine manager too
				engineManager.setBoardDrawn(data.id, boardNum);

				// Notify clients
				gameSocket.in(socket.room).emit('board drawn', { boardNum });

				// Check if both boards are now drawn
				if (localDrawnBoards[data.id][1] && localDrawnBoards[data.id][2]) {
					engineManager.cleanupGame(data.id);
					delete gameTokens[data.id];
					delete localDrawnBoards[data.id];
					await Game.endGame(game, 'Game drawn by agreement', socket, gameSocket, clearRoom);
				}
			} catch (err) {
				logger.error(`Local accept draw error: ${err}`);
			}
		});

		// Local game: decline draw on a specific board
		socket.on('local decline draw', data => {
			gameSocket.in(socket.room).emit('local draw declined', {
				boardNum: data.boardNum
			});
		});
	});
};
