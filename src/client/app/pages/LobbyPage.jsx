import React, { Component } from 'react';
import { browserHistory } from 'react-router';
import axios from 'axios';
import HeaderContainer from '../containers/header/HeaderContainer';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const PRESETS = [
	{ label: '1+0', minutes: 1, increment: 0 },
	{ label: '3+2', minutes: 3, increment: 2 },
	{ label: '5+5', minutes: 5, increment: 5 },
	{ label: '10+0', minutes: 10, increment: 0 },
	{ label: 'Custom', minutes: null, increment: null },
];

export default class LobbyPage extends Component {
	constructor(props) {
		super(props);
		this.state = {
			preset: '5+5',
			minutes: 5,
			increment: 5,
			customMinutes: 5,
			customIncrement: 5,
			joinCode: '',
			creating: false,
			joining: false,
			error: '',
			joinError: '',
			pausedGames: [],
		};
	}

	componentDidMount() {
		if (this.props.currentUser && this.props.currentUser.token) {
			axios.get(`${BACKEND}/api/games/paused`)
				.then(res => this.setState({ pausedGames: res.data || [] }))
				.catch(() => {});
		}
	}

	handlePreset(p) {
		if (p.minutes !== null) this.setState({ preset: p.label, minutes: p.minutes, increment: p.increment });
		else this.setState({ preset: 'Custom' });
	}

	handleCustom(field, val) {
		const n = Math.max(0, parseInt(val) || 0);
		if (field === 'minutes') this.setState({ customMinutes: n, minutes: n });
		else this.setState({ customIncrement: n, increment: n });
	}

	async createGame() {
		if (!(this.props.currentUser && this.props.currentUser.token)) return browserHistory.push('/auth');
		this.setState({ creating: true, error: '' });
		try {
			const { data } = await axios.post(`${BACKEND}/api/lobby/create`,
				{ minutes: this.state.minutes, increment: this.state.increment },
				{ headers: { Authorization: `Bearer ${this.props.currentUser.token}` } }
			);
			browserHistory.push(`/lobby/${data.gameId}`);
		} catch (err) {
			this.setState({ creating: false, error: (err.response && err.response.data && err.response.data.error) || 'Failed to create game' });
		}
	}

	async resumeGame(gameId) {
		try {
			await axios.post(`${BACKEND}/api/games/resume/${gameId}`);
			browserHistory.push(`/game/${gameId}`);
		} catch (err) {
			this.setState({ error: 'Failed to resume game' });
		}
	}

	async joinGame() {
		const code = this.state.joinCode.trim().toUpperCase();
		if (!code || code.length !== 6) return this.setState({ joinError: 'Enter a 6-character room code' });
		if (!(this.props.currentUser && this.props.currentUser.token)) return browserHistory.push('/auth');
		this.setState({ joining: true, joinError: '' });
		try {
			const { data } = await axios.post(`${BACKEND}/api/lobby/join`,
				{ roomCode: code },
				{ headers: { Authorization: `Bearer ${this.props.currentUser.token}` } }
			);
			browserHistory.push(`/lobby/${data.gameId}`);
		} catch (err) {
			this.setState({ joining: false, joinError: (err.response && err.response.data && err.response.data.error) || 'Room not found' });
		}
	}

	render() {
		const { preset, customMinutes, customIncrement, joinCode, creating, joining, error, joinError, pausedGames } = this.state;
		const username = this.props.currentUser && this.props.currentUser.username;
		const myPausedGames = pausedGames.filter(g => g.p1 === username || g.p2 === username || g.p3 === username || g.p4 === username);
		const isCustom = preset === 'Custom';

		return (
			<div className="bg-bg-base min-h-screen">
				<HeaderContainer />
				<div className="max-w-2xl mx-auto px-6 py-12">
					<h1 className="text-text-main text-3xl font-bold mb-2">Play Bughouse</h1>
					<p className="text-text-dim mb-10">Create a game and share your room code, or join with a code from a friend.</p>

					<div className="grid gap-6 md:grid-cols-2">
						{/* Create game */}
						<div className="bg-bg-card border border-border-dim rounded-xl p-6">
							<h2 className="text-text-main font-semibold text-lg mb-4">Create Game</h2>

							<div className="mb-4">
								<label className="text-text-dim text-xs font-medium uppercase tracking-wide mb-2 block">Time Control</label>
								<div className="flex flex-wrap gap-2">
									{PRESETS.map(p => (
										<button
											key={p.label}
											onClick={() => this.handlePreset(p)}
											className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
												preset === p.label ? 'bg-accent border-accent text-white' : 'border-border-dim text-text-dim hover:border-accent hover:text-text-main'
											}`}
										>
											{p.label}
										</button>
									))}
								</div>
								{isCustom && (
									<div className="flex gap-3 mt-3">
										<div className="flex-1">
											<label className="block text-text-dim text-xs mb-1">Minutes</label>
											<input
												type="number" min="1" max="60"
												value={customMinutes}
												onChange={e => this.handleCustom('minutes', e.target.value)}
												className="w-full bg-bg-panel border border-border-dim rounded px-2 py-1.5 text-text-main text-sm focus:outline-none focus:border-accent"
											/>
										</div>
										<div className="flex-1">
											<label className="block text-text-dim text-xs mb-1">Increment (sec)</label>
											<input
												type="number" min="0" max="60"
												value={customIncrement}
												onChange={e => this.handleCustom('increment', e.target.value)}
												className="w-full bg-bg-panel border border-border-dim rounded px-2 py-1.5 text-text-main text-sm focus:outline-none focus:border-accent"
											/>
										</div>
									</div>
								)}
							</div>

							{error && <p className="text-red-400 text-xs mb-3">{error}</p>}

							<button
								onClick={() => this.createGame()}
								disabled={creating}
								className="w-full bg-accent hover:bg-orange-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
							>
								{creating ? 'Creating…' : 'Create Game'}
							</button>
						</div>

						{/* Join game */}
						<div className="bg-bg-card border border-border-dim rounded-xl p-6 flex flex-col">
							<h2 className="text-text-main font-semibold text-lg mb-4">Join Game</h2>
							<p className="text-text-dim text-sm mb-4">Enter the 6-character room code shared by the game creator.</p>

							<div className="mb-4">
								<label className="text-text-dim text-xs font-medium uppercase tracking-wide mb-2 block">Room Code</label>
								<input
									type="text"
									value={joinCode}
									onChange={e => this.setState({ joinCode: e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) })}
									onKeyDown={e => e.key === 'Enter' && this.joinGame()}
									className="w-full bg-bg-panel border border-border-dim rounded-lg px-3 py-2.5 text-text-main text-2xl font-mono text-center tracking-widest focus:outline-none focus:border-accent-blue transition-colors"
									placeholder="XXXXXX"
									maxLength={6}
								/>
							</div>

							{joinError && <p className="text-red-400 text-xs mb-3">{joinError}</p>}

							<div className="mt-auto">
								<button
									onClick={() => this.joinGame()}
									disabled={joining || joinCode.length !== 6}
									className="w-full bg-accent-blue hover:bg-blue-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
								>
									{joining ? 'Joining…' : 'Join Game'}
								</button>
							</div>
						</div>
					</div>

					<div className="mt-8 text-center">
						<p className="text-text-dim text-sm">
							Your rating: <span className="text-accent font-bold text-lg">{(this.props.currentUser && this.props.currentUser.rating) || 1500}</span>
						</p>
					</div>

					{myPausedGames.length > 0 && (
						<div className="mt-8">
							<h2 className="text-text-main font-semibold text-lg mb-3">Paused Games</h2>
							<div className="space-y-3">
								{myPausedGames.map(g => (
									<div key={g.id} className="bg-bg-card border border-border-dim rounded-xl p-4 flex items-center justify-between">
										<div>
											<div className="text-text-main text-sm font-medium mb-1">
												{g.p1 || 'Engine'} &amp; {g.p4 || 'Engine'} <span className="text-text-dim">vs</span> {g.p2 || 'Engine'} &amp; {g.p3 || 'Engine'}
											</div>
											<div className="text-text-dim text-xs">{g.minutes}+{g.increment} · {g.mode || 'Rated'}</div>
										</div>
										<button
											onClick={() => this.resumeGame(g.id)}
											className="bg-accent hover:bg-orange-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
										>
											Resume
										</button>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}
}
