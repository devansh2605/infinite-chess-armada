import React from 'react';
import { Link } from 'react-router';
import supabase from '../../lib/supabaseClient';

export default function HeaderComponent(props) {
	async function logout() {
		await supabase.auth.signOut();
		localStorage.removeItem('token');
		props.updateCurrentUser({});
	}

	return (
		<header className="sticky top-0 z-50 bg-bg-card border-b border-border-dim flex items-center justify-between px-6 py-3">
			<Link to="/local" className="flex items-center gap-2 select-none">
				<span className="text-accent font-bold text-lg tracking-tight">Infinite</span>
				<span className="text-text-main font-bold text-lg tracking-tight">Chess</span>
				<span className="text-accent-blue font-bold text-lg tracking-tight">Armada</span>
			</Link>
			<nav className="flex items-center gap-6 text-sm font-medium text-text-dim">
				<Link to="/local" className="hover:text-text-main transition-colors">Play</Link>
				<Link to="/leaderboard" className="hover:text-text-main transition-colors">Leaderboard</Link>
				<Link to="/history" className="hover:text-text-main transition-colors">History</Link>
			</nav>
			<div className="flex items-center gap-4 text-sm">
				{props.isLoggedIn ? (
					<span className="flex items-center gap-4">
						<span className="text-text-dim text-xs bg-bg-panel px-2 py-0.5 rounded font-medium">
							{(props.currentUser && props.currentUser.rating) || 1500}
						</span>
						<Link to={'/user/' + props.username} className="text-accent hover:text-orange-400 font-semibold transition-colors">
							{props.username}
						</Link>
						<button onClick={logout} className="text-text-dim hover:text-text-main transition-colors bg-transparent border-none cursor-pointer p-0">
							Logout
						</button>
					</span>
				) : (
					<Link to="/auth" className="bg-accent hover:bg-orange-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
						Log In
					</Link>
				)}
			</div>
		</header>
	);
}
