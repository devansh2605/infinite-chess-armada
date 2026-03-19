const express = require('express');
const Game = require('../models/Game');
const Bug = require('../services/bug');
const validate = require('jsonschema').validate;
const engineManager = require('../services/engineManager');
const supabase = require('../lib/supabaseAdmin');

const router = express.Router();

/* GET all open games */
router.get('/open', async (req, res, next) => {
	try {
		const rows = await Game.getAllOpen();
		res.json(rows);
	} catch (err) {
		next(err);
	}
});

/* Get a single game with users information, include user's position */
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
		return res.sendStatus(400);
	}
	try {
		const row = await Game.getGameWithUsersByID(req.params.id);
		if (req.body.token) {
			const { data: { user }, error } = await supabase.auth.getUser(req.body.token);
			if (!error && user) {
				if (row.player2 && row.player2.id === user.id) row.userPosition = 2;
				else if (row.player3 && row.player3.id === user.id) row.userPosition = 3;
				else if (row.player4 && row.player4.id === user.id) row.userPosition = 4;
				else row.userPosition = 1;
			} else {
				row.userPosition = 1;
			}
		} else {
			row.userPosition = 1;
		}
		res.json(row);
	} catch (err) {
		next(err);
	}
});

/* Get if a user is a game player or an observer */
router.put('/userIsPlayingOrObserving/:id', async (req, res) => {
	try {
		const token = req.body.token;
		if (req.params.id === 'undefined' || !token) {
			return res.sendStatus(400);
		}
		const row = await Game.getGameWithUsersByID(req.params.id);
		if (row.status !== 'playing') {
			return res.json({ isPlaying: false });
		}
		const { data: { user }, error } = await supabase.auth.getUser(token);
		if (error || !user) {
			return res.json({ isPlaying: false });
		}
		const isPlaying = [row.player1, row.player2, row.player3, row.player4]
			.some(p => p && p.id === user.id);
		res.json({ isPlaying });
	} catch (err) {
		res.status(500).send({ isPlaying: false });
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
		return res.sendStatus(400);
	}
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
});

/* Check if pawn promotion is possible */
router.put('/validate/pawnpromotion/:id', async (req, res) => {
	try {
		if (!(req.body.source && typeof req.body.piece.role === 'string' && typeof req.body.target === 'string' && req.params.id)) {
			res.json({ valid: false });
			return;
		}
		if (req.body.source === 'spare' || req.body.piece.role.charAt(0).toLowerCase() !== 'p' || (req.body.target.charAt(1) !== '1' && req.body.target.charAt(1) !== '8')) {
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
			promotion: 'q'
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

/* POST pause a game */
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
