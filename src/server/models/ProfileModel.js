const supabase = require('../lib/supabaseAdmin');

class ProfileModel {
	static async getByID(id) {
		const { data, error } = await supabase
			.from('profiles')
			.select('id, username, rating, games_played')
			.eq('id', id)
			.single();
		if (error || !data) {
			const err = new Error('Profile not found');
			err.status = 404;
			throw err;
		}
		return data;
	}

	static async getByUsername(username) {
		const { data, error } = await supabase
			.from('profiles')
			.select('id, username, rating, games_played')
			.eq('username', username)
			.single();
		if (error || !data) return null;
		return data;
	}

	static async updateRating(id, newRating) {
		const { error } = await supabase
			.from('profiles')
			.update({ rating: newRating })
			.eq('id', id);
		if (error) throw new Error(error.message);
	}

	static async incrementGamesPlayed(id) {
		// Fetch current count then increment (Supabase JS v2 doesn't support rpc increment inline easily)
		const profile = await ProfileModel.getByID(id);
		const { error } = await supabase
			.from('profiles')
			.update({ games_played: (profile.games_played || 0) + 1 })
			.eq('id', id);
		if (error) throw new Error(error.message);
	}

	static async getAll(limit = 50) {
		const { data, error } = await supabase
			.from('profiles')
			.select('id, username, rating, games_played')
			.order('rating', { ascending: false })
			.limit(limit);
		if (error) throw new Error(error.message);
		return data || [];
	}
}

module.exports = ProfileModel;
