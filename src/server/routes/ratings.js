const express = require('express');
const supabase = require('../lib/supabaseAdmin');
const ProfileModel = require('../models/ProfileModel');

const router = express.Router();

// GET /api/ratings/leaderboard
router.get('/leaderboard', async (_req, res) => {
	try {
		const profiles = await ProfileModel.getAll(50);
		res.json(profiles);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// GET /api/ratings/history?gameId=xxx
router.get('/history', async (req, res) => {
	try {
		const { gameId, userId } = req.query;
		let query = supabase
			.from('rating_history')
			.select('*, profile:profiles(username)')
			.order('recorded_at', { ascending: false });

		if (gameId) query = query.eq('game_id', gameId);
		if (userId) query = query.eq('player_id', userId).limit(50);

		const { data, error } = await query;
		if (error) throw new Error(error.message);
		res.json(data || []);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
