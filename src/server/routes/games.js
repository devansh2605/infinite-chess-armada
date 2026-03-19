const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const Bug = require('../services/bug');
const jwt = require('jsonwebtoken');
const validate = require('jsonschema').validate;
const secretToken = require('../config').secretToken;
const engineManager = require('../services/engineManager');

const router = express.Router();

/* Create a local game with all 4 players */
router.post('/local', async (req, res) => {
	const validReq = {
		type: 'object',
		required: ['player1', 'player2', 'player3', 'player4', 'minutes', 'increment', 'token'],
		properties: {
			player1: { type: 'integer' },
			player2: { type: 'integer' },
			player3: { type: 'integer' },
			player4: { type: 'integer' },
			minutes: { type: 'integer' },
			increment: { type: 'integer' },
			token: { type: 'string' }
		}
	};
	try {
		if (!validate(req.body, validReq).valid
			|| req.body.minutes < 1 || req.body.minutes > 20
			|| req.body.increment < 0 || req.body.increment > 30) {
			return res.sendStatus(400);
		}
		const decoded = jwt.verify(req.body.token, secretToken);
		if (decoded.id !== req.body.player1 && decoded.id !== req.body.player2
			&& decoded.id !== req.body.player3 && decoded.id !== req.body.player4) {
			return res.sendStatus(400);
		}

		const id = await Game.createLocalGame(
			req.body.player1, req.body.player2,
			req.body.player3, req.body.player4,
			req.body.minutes, req.body.increment
		);

		const [user1, user2, user3, user4] = await Promise.all([
			User.getByID(req.body.player1),
			User.getByID(req.body.player2),
			User.getByID(req.body.player3),
			User.getByID(req.body.player4)
		]);

		const playerTokens = {
			player1Token: jwt.sign(JSON.parse(JSON.stringify(user1)), secretToken, { expiresIn: '7 days' }),
			player2Token: jwt.sign(JSON.parse(JSON.stringify(user2)), secretToken, { expiresIn: '7 days' }),
			player3Token: jwt.sign(JSON.parse(JSON.stringify(user3)), secretToken, { expiresIn: '7 days' }),
			player4Token: jwt.sign(JSON.parse(JSON.stringify(user4)), secretToken, { expiresIn: '7 days' })
		};

		// Register engine players if any
		const ep = req.body.enginePlayers || {};
		const esl = req.body.engineSkillLevels || {};
		const enginePlayers = {
			1: !!ep[1], 2: !!ep[2], 3: !!ep[3], 4: !!ep[4]
		};
		const engineSkillLevels = {
			1: Math.min(10, Math.max(1, parseInt(esl[1]) || 5)),
			2: Math.min(10, Math.max(1, parseInt(esl[2]) || 5)),
			3: Math.min(10, Math.max(1, parseInt(esl[3]) || 5)),
			4: Math.min(10, Math.max(1, parseInt(esl[4]) || 5))
		};
		const hasEngines = enginePlayers[1] || enginePlayers[2] || enginePlayers[3] || enginePlayers[4];
		if (hasEngines) {
			engineManager.registerGame(id, enginePlayers, engineSkillLevels);
		}

		res.json({ id, playerTokens, enginePlayers });
	} catch (err) {
		res.status(400).send({ error: 'Failed to create local game' });
	}
});

/* Create a new game */
router.post('/', async (req, res) => {
	const validReq = {
		type: 'object',
		maxProperties: 8,
		required: ['minutes', 'increment', 'player1', 'player2', 'ratingRange', 'mode', 'joinRandom', 'token'],
		properties: {
			minutes: { type: 'integer' },
			increment: { type: 'integer' },
			player1: { type: ['integer', null] },
			player2: { type: ['integer', null] },
			ratingRange: { type: 'string' },
			mode: { type: 'string' },
			joinRandom: { type: 'boolean' },
			token: { type: 'string' }
		}
	};
	try {
		if ((!validate(req.body, validReq).valid)
			|| (req.body.mode !== 'Rated' && req.body.mode !== 'Casual')
			|| (req.body.minutes < 1)
			|| (req.body.minutes > 20)
			|| (req.body.increment < 0)
			|| (req.body.increment > 30)
			|| (req.body.player1 && req.body.player2)
			|| (!req.body.player1 && !req.body.player2)
			|| (req.body.ratingRange.split(' - ').length === 1)
			|| (parseInt(req.body.ratingRange.split(' - ')[0]) < 0)
			|| (parseInt(req.body.ratingRange.split(' - ')[1]) > 3000)) {
			res.sendStatus(400);
		} else {
			const requestPlayerID = req.body.player1 ? req.body.player1 : req.body.player2;
			if (requestPlayerID) {
				jwt.verify(req.body.token, secretToken, async (err, decoded) => {
					if (err || decoded.id !== requestPlayerID) {
						res.sendStatus(400);
					} else {
						const id = await Game.createGame(req.body.player1, req.body.player2, undefined, undefined, req.body.minutes, req.body.increment, req.body.ratingRange, req.body.mode, req.body.joinRandom);
						res.json({ id });
					}
				});
			}
		}
	} catch (err) {
		res.status(400).send({ error: 'Failed to create game' });
	}
});

/* GET all open games */
router.get('/open', async (req, res, next) => {
	try {
		const rows = await Game.getAllOpen();
		res.json(rows);
	} catch (err) {
		next(err);
	}
});

/* Get a single game with users information, include user's position
 * Note that the users ratings are relative to the start of the game, not their current rating
 */
router.put('/withUsers/:id', async (req, res, next) => {
	const validReqParams = {
		type: 'object',
		maxProperties: 1,
		required: ['id'],
		properties: {
			id: { type: 'string' }
		}
	};
	const validReqBody = {
		type: 'object',
		maxProperties: 1,
		required: ['token'],
		properties: {
			token: { type: ['string', 'null'] }
		}
	};
	if (!validate(req.params, validReqParams).valid || !validate(req.body, validReqBody).valid) {
		res.sendStatus(400);
	} else {
		try {
			const row = await Game.getGameWithUsersByID(req.params.id);
			if (req.body.token) {
				jwt.verify(req.body.token, secretToken, (err, decoded) => {
					if (err) {
						row.userPosition = 1;
					} else {
						if (row.player2.id === decoded.id) row.userPosition = 2;
						else if (row.player3.id === decoded.id) row.userPosition = 3;
						else if (row.player4.id === decoded.id) row.userPosition = 4;
						else row.userPosition = 1;
					}
					res.json(row);
				});
			} else {
				row.userPosition = 1;
				res.json(row);
			}
		} catch (err) {
			next(err);
		}
	}
});

/* Get if a user is a game player or an observer */
router.put('/userIsPlayingOrObserving/:id', async (req, res) => {
	try {
		const token = req.body.token;
		if (req.params.id === 'undefined' || !token) {
			res.sendStatus(400);
		}
		const row = await Game.getGameWithUsersByID(req.params.id);
		if (row.status !== 'playing') {
			res.json({ isPlaying: false });
		} else {
			jwt.verify(token, secretToken, (err, decoded) => {
				if (err) {
					res.json({ isPlaying: false });
				} else {
					if (row.player1.id === decoded.id || row.player2.id === decoded.id || row.player3.id === decoded.id || row.player4.id === decoded.id) {
						res.json({ isPlaying: true });
					} else {
						res.json({ isPlaying: false });
					}
				}
			});
		}
	} catch (err) {
		res.status(500).send({ isPlaying: false });
	}
});

/**
 * Update player for an open game
 *
 * @param {string} id Game ID
 * @param {string} playerPosition Can be either player1, player2, player3, player4
 * @param {int} player Player ID
 */
router.put('/open/:id', async (req, res, next) => {
	const validReqParams = {
		type: 'object',
		maxProperties: 1,
		required: ['id'],
		properties: {
			id: { type: 'string' }
		}
	};
	const validReqBody = {
		type: 'object',
		maxProperties: 2,
		required: ['playerPosition', 'player'],
		properties: {
			playerPosition: { type: 'string' },
			player: { type: 'number' }
		}
	};
	if (!validate(req.params, validReqParams).valid || !validate(req.body, validReqBody).valid) {
		res.sendStatus(400);
	} else {
		try {
			const result = await Game.updatePlayer(req.params.id, req.body.playerPosition, req.body.player);
			if (!result) {
				res.sendStatus(400);
			} else {
				res.end();
			}
		} catch (err) {
			next(err);
		}
	}
});

/**
 * Remove player from all open games
 *
 * @param {string} id Game ID
 * @param {string} token User token
 */
router.put('/remove', async (req, res, next) => {
	const validReqBody = {
		type: 'object',
		maxProperties: 2,
		required: ['token', 'gameID'],
		properties: {
			token: { type: 'string' }
		}
	};
	if (!validate(req.body, validReqBody).valid) {
		res.sendStatus(400);
	} else {
		try {
			jwt.verify(req.body.token, secretToken, async (err, decoded) => {
				if (err) {
					err.status = 401;
					throw err;
				} else {
					await Game.removePlayerFromGame(decoded.id, req.body.gameID);
					res.sendStatus(200);
				}
			});
		} catch (err) {
			next(err);
		}
	}
});

/* Fetch game state */
router.get('/state/:id', async (req, res, next) => {
	const validReq = {
		type: 'object',
		maxProperties: 1,
		required: ['id'],
		properties: {
			id: { type: 'string' }
		}
	};
	function convertReserveToSparePieces(reserve) {
		if (!reserve) return [];
		return JSON.parse(reserve).map(row => {
			const letters = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
			return {
				role: letters[row.type],
				color: row.color === 'w' ? 'white' : 'black'
			};
		});
	}
	if (!validate(req.params, validReq).valid) {
		res.sendStatus(400);
	} else {
		try {
			const game = await Game.getByID(req.params.id);
			res.json({
				leftReserveWhite: convertReserveToSparePieces(game.left_reserve_white),
				leftReserveBlack: convertReserveToSparePieces(game.left_reserve_black),
				rightReserveWhite: convertReserveToSparePieces(game.right_reserve_white),
				rightReserveBlack: convertReserveToSparePieces(game.right_reserve_black),
				moves: game.moves,
				leftFens: game.left_fens.split(','),
				rightFens: game.right_fens.split(','),
				leftLastMove: JSON.parse(game.left_last_move),
				rightLastMove: JSON.parse(game.right_last_move),
				leftColorToPlay: game.left_color_to_play,
				rightColorToPlay: game.right_color_to_play,
				clocks: game.clocks.split(',').map(Number),
				leftLastTime: parseInt(game.left_last_time),
				rightLastTime: parseInt(game.right_last_time),
				resignState: game.resign_state,
				drawState: game.draw_state,
				termination: game.termination
			});
		} catch (err) {
			next(err);
		}
	}
});

/* Check if pawn promotion is possible */
router.put('/validate/pawnpromotion/:id', async (req, res) => {
	try {
		if (!(req.body.source && typeof req.body.piece.role === 'string' && typeof req.body.target === 'string' && req.params.id)) {
			res.json({ valid: false });
			return;
		}
		if (req.body.source === 'spare' || req.body.piece.role.charAt(0).toLowerCase() !== 'p' || (req.body.target.charAt(1) !== '1' && req.body.target.charAt(1) !== '8')) { // Not a valid promotion
			res.json({ valid: false });
			return;
		}
		const row = await Game.getByID(req.params.id);
		const leftFens = row.left_fens.split(',');
		const rightFens = row.right_fens.split(',');
		let game;
		if (req.body.userPosition === 1 || req.body.userPosition === 2) {
			game = new Bug(leftFens[leftFens.length - 1]);
		} else {
			game = new Bug(rightFens[rightFens.length - 1]);
		}
		const move = game.move({
			from: req.body.source,
			to: req.body.target,
			promotion: 'q' // doesn't matter the promotion piece, user will decide later
		});
		if (move) {
			res.json({ valid: true });
		} else {
			res.json({ valid: false, fen: game.fen() });
		}
	} catch (err) {
		res.status(400).send({ error: 'Failed to validate pawn promotion' });
	}
});

router.get('/history', async (_req, res) => {
	try {
		const games = await Game.getRecentCompleted(30);
		res.json(games);
	} catch (err) {
		res.status(500).json({ error: 'Failed to fetch game history' });
	}
});

/* GET all paused games */
router.get('/paused', async (_req, res) => {
	try {
		const games = await Game.getPausedGames();
		res.json(games);
	} catch (err) {
		res.status(500).json({ error: 'Failed to fetch paused games' });
	}
});

/* POST pause a game — saves elapsed clock time, sets status=paused */
router.post('/pause/:id', async (req, res) => {
	try {
		const game = await Game.getByID(req.params.id);
		if (game.status !== 'playing') return res.sendStatus(400);
		const clocks = game.clocks.split(',').map(Number);
		const now = Date.now();
		if (game.left_last_time) {
			const elapsed = now - parseInt(game.left_last_time);
			if (game.left_color_to_play === 'white') clocks[0] += elapsed;
			else clocks[1] += elapsed;
		}
		if (game.right_last_time) {
			const elapsed = now - parseInt(game.right_last_time);
			if (game.right_color_to_play === 'white') clocks[2] += elapsed;
			else clocks[3] += elapsed;
		}
		await Game.pauseGame(req.params.id, clocks);
		res.sendStatus(200);
	} catch (err) {
		res.status(500).json({ error: 'Failed to pause game' });
	}
});

/* POST resume a paused game */
router.post('/resume/:id', async (req, res) => {
	try {
		const game = await Game.getByID(req.params.id);
		if (game.status !== 'paused') return res.sendStatus(400);
		await Game.resumeGame(req.params.id);
		res.sendStatus(200);
	} catch (err) {
		res.status(500).json({ error: 'Failed to resume game' });
	}
});

module.exports = router;
