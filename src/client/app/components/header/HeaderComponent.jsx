import React from 'react';
import { Link } from 'react-router';

export default function HeaderComponent(props) {
	function logout() {
		localStorage.removeItem('token');
		props.updateCurrentUser({});
	}

	return (
		<header className="sticky top-0 z-50 bg-bg-card border-b border-border-dim flex items-center justify-between px-6 py-3">
			<Link to="/" className="flex items-center gap-2 select-none">
				<span className="text-accent font-bold text-lg tracking-tight">Infinite</span>
				<span className="text-text-main font-bold text-lg tracking-tight">Chess</span>
				<span className="text-accent-blue font-bold text-lg tracking-tight">Armada</span>
			</Link>
			<nav className="flex items-center gap-6 text-sm font-medium text-text-dim">
				<Link to="/" className="hover:text-text-main transition-colors">Play</Link>
				<Link to="/leaderboard" className="hover:text-text-main transition-colors">Leaderboard</Link>
				<Link to="/history" className="hover:text-text-main transition-colors">History</Link>
				<Link to="/about" className="hover:text-text-main transition-colors">About</Link>
			</nav>
			<div className="flex items-center gap-4 text-sm">
				{props.isLoggedIn ? (
					<span className="flex items-center gap-4">
						<Link to={`/user/${props.username}`} className="text-accent hover:text-orange-400 font-semibold transition-colors">
							{props.username}
						</Link>
						<button
							onClick={logout}
							className="text-text-dim hover:text-text-main transition-colors bg-transparent border-none cursor-pointer p-0"
						>
							Logout
						</button>
					</span>
				) : (
					<span className="flex items-center gap-4">
						<Link to="/register" className="text-text-dim hover:text-text-main transition-colors">Register</Link>
					</span>
				)}
			</div>
		</header>
	);
}
