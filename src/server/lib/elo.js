/**
 * FIDE Elo rating system for Bughouse (4-player team game).
 *
 * K-factor:
 *   40 for first 30 rated games (provisional)
 *   20 thereafter
 *
 * Team assignment:
 *   Team 1: player slots 1 (left-white) + 4 (right-black)
 *   Team 2: player slots 2 (left-black) + 3 (right-white)
 *
 * Each player's Elo is calculated against the average rating of the two opponents.
 */

function kFactor(gamesPlayed) {
	return gamesPlayed < 30 ? 40 : 20;
}

function expectedScore(playerRating, opponentRating) {
	return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

/**
 * Compute Elo updates for all human players in a completed game.
 *
 * @param {Object} profiles  - { p1, p2, p3, p4 } each with { id, rating, gamesPlayed }
 *                             Set to null for engine slots.
 * @param {String} winner    - 'team1' | 'team2' | 'draw'
 * @returns {Object}         - { 1: { id, oldRating, newRating, delta }, ... } (only human slots)
 */
function computeEloUpdates(profiles, winner) {
	const score = slot => {
		if (winner === 'draw') return 0.5;
		return (winner === 'team1' ? [1, 4] : [2, 3]).includes(slot) ? 1.0 : 0.0;
	};

	// Average rating for each team (using only human players; use 1500 as stand-in for engines)
	const team1Ratings = [profiles.p1, profiles.p4].map(p => (p ? p.rating : 1500));
	const team2Ratings = [profiles.p2, profiles.p3].map(p => (p ? p.rating : 1500));
	const team1Avg = Math.round((team1Ratings[0] + team1Ratings[1]) / 2);
	const team2Avg = Math.round((team2Ratings[0] + team2Ratings[1]) / 2);
	const opponentAvgOf = { 1: team2Avg, 4: team2Avg, 2: team1Avg, 3: team1Avg };

	const slotToProfile = { 1: profiles.p1, 2: profiles.p2, 3: profiles.p3, 4: profiles.p4 };
	const updates = {};

	for (const [slot, profile] of Object.entries(slotToProfile)) {
		if (!profile) continue; // engine slot — skip
		const s = Number(slot);
		const k = kFactor(profile.gamesPlayed || 0);
		const delta = Math.round(k * (score(s) - expectedScore(profile.rating, opponentAvgOf[s])));
		const newRating = Math.max(100, profile.rating + delta); // floor at 100
		updates[s] = { id: profile.id, oldRating: profile.rating, newRating, delta: newRating - profile.rating };
	}

	return updates;
}

module.exports = { computeEloUpdates };
