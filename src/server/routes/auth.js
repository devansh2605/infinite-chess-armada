const express = require('express');
const supabase = require('../lib/supabaseAdmin');
const ProfileModel = require('../models/ProfileModel');

const router = express.Router();

// Verify a Supabase JWT and return the user's profile
router.post('/verify', async (req, res) => {
	const { token } = req.body;
	if (!token) return res.sendStatus(401);

	const { data: { user }, error } = await supabase.auth.getUser(token);
	if (error || !user) return res.sendStatus(401);

	try {
		const profile = await ProfileModel.getByID(user.id);
		res.json({ success: true, user: profile });
	} catch {
		res.sendStatus(401);
	}
});

// Check username availability
router.get('/username/:username', async (req, res) => {
	const profile = await ProfileModel.getByUsername(req.params.username);
	res.json({ available: !profile });
});

module.exports = router;
