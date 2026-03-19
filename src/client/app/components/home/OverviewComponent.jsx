import React from 'react';
import axios from 'axios';
import { browserHistory } from 'react-router';
import CreateGameContainer from '../../containers/home/CreateGameContainer';
import JoinGameModalContainer from '../../containers/home/JoinGameModalContainer';
import LoginContainer from '../../containers/home/LoginContainer';
import LobbyContainer from '../../containers/home/LobbyContainer';

export default class OverviewComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = { pausedGames: [], recentGames: [] };
		this.handleResumeGame = this.handleResumeGame.bind(this);
	}

	componentWillMount() {
		this.props.updateDisplayedGames();
	}

	componentDidMount() {
		axios.get('/api/games/paused')
			.then(res => this.setState({ pausedGames: res.data || [] }))
			.catch(() => {});
		axios.get('/api/games/history')
			.then(res => this.setState({ recentGames: (res.data || []).slice(0, 5) }))
			.catch(() => {});
	}

	handleResumeGame(gameId) {
		const saved = localStorage.getItem(`pausedGame_${gameId}`);
		if (saved) {
			try {
				const { playerTokens, enginePlayers } = JSON.parse(saved);
				this.props.setLocalMode(playerTokens, enginePlayers);
			} catch (e) { /* ignore */ }
		}
		browserHistory.push(`/game/${gameId}`);
	}

	renderPausedGames() {
		const { pausedGames } = this.state;
		if (!pausedGames.length) return null;
		return (
			<div className="bg-bg-card border border-border-dim rounded-lg p-4 mt-4">
				<div className="text-xs uppercase tracking-wide text-text-dim font-medium mb-3">In Progress</div>
				{pausedGames.map(g => (
					<div
						key={g.id}
						className="flex items-center justify-between py-2 border-b border-border-dim/40 last:border-0 cursor-pointer hover:bg-bg-hover rounded px-2 -mx-2"
						onClick={() => this.handleResumeGame(g.id)}
					>
						<div className="text-xs text-text-main">
							<span className="text-accent font-medium">{g.p1}</span>
							<span className="text-text-dim"> & </span>
							<span className="text-accent font-medium">{g.p4}</span>
							<span className="text-text-dim mx-1">vs</span>
							<span className="text-accent-blue font-medium">{g.p2}</span>
							<span className="text-text-dim"> & </span>
							<span className="text-accent-blue font-medium">{g.p3}</span>
						</div>
						<span className="text-xs text-text-dim ml-2 flex-shrink-0">{g.minutes}+{g.increment}</span>
					</div>
				))}
			</div>
		);
	}

	renderRecentGames() {
		const { recentGames } = this.state;
		if (!recentGames.length) return null;
		return (
			<div className="bg-bg-card border border-border-dim rounded-lg p-4 mt-4">
				<div className="text-xs uppercase tracking-wide text-text-dim font-medium mb-3">Past Games</div>
				{recentGames.map((g, i) => (
					<div key={g.id || i} className="py-2 border-b border-border-dim/40 last:border-0">
						<div className="flex items-center justify-between text-xs">
							<div>
								<span className="text-accent font-medium">{g.p1}</span>
								<span className="text-text-dim"> &amp; </span>
								<span className="text-accent font-medium">{g.p4}</span>
								<span className="text-text-dim mx-1">vs</span>
								<span className="text-accent-blue font-medium">{g.p2}</span>
								<span className="text-text-dim"> &amp; </span>
								<span className="text-accent-blue font-medium">{g.p3}</span>
							</div>
							<span className="text-text-dim ml-2 flex-shrink-0">{g.minutes}+{g.increment}</span>
						</div>
						{g.termination && (
							<div className="text-xs text-text-dim mt-0.5 truncate">{g.termination}</div>
						)}
					</div>
				))}
			</div>
		);
	}

	render() {
		return (
			<div className="flex gap-8 px-6 py-8 min-h-screen bg-bg-base">
				{/* Left panel: login + actions + in-progress + past games */}
				<div className="flex flex-col gap-4 w-80 flex-shrink-0">
					<LoginContainer />
					<CreateGameContainer />
					{this.renderPausedGames()}
					{this.renderRecentGames()}
				</div>
				{/* Right panel: lobby */}
				<div className="flex-1 min-w-0">
					<LobbyContainer />
				</div>
				<JoinGameModalContainer />
			</div>
		);
	}
}
