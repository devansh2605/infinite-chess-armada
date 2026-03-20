import React, { Component } from 'react';
import { browserHistory } from 'react-router';
import io from 'socket.io-client';
import HeaderContainer from '../containers/header/HeaderContainer';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

const TEAM_CONFIG = {
	1: { label: 'Player 1 — White', team: 'Team 1', teamClass: 'bg-orange-900/30 text-accent', boardLabel: 'Left Board' },
	2: { label: 'Player 2 — Black', team: 'Team 2', teamClass: 'bg-blue-900/30 text-accent-blue', boardLabel: 'Left Board' },
	3: { label: 'Player 3 — White', team: 'Team 2', teamClass: 'bg-blue-900/30 text-accent-blue', boardLabel: 'Right Board' },
	4: { label: 'Player 4 — Black', team: 'Team 1', teamClass: 'bg-orange-900/30 text-accent', boardLabel: 'Right Board' },
};

export default class LobbyWaitingRoom extends Component {
	constructor(props) {
		super(props);
		this.state = {
			lobbyState: null,
			error: '',
			starting: false,
			copied: false,
		};
		this.socket = null;
	}

	get gameId() { return (this.props.params && this.props.params.splat) || (this.props.params && this.props.params.gameId); }
	get token() { return this.props.currentUser && this.props.currentUser.token; }
	get userId() { return this.props.currentUser && this.props.currentUser.id; }

	componentDidMount() {
		if (!this.token) { browserHistory.push('/auth'); return; }
		this.socket = io(`${BACKEND}/lobby`);

		this.socket.on('lobby_state', state => this.setState({ lobbyState: state }));
		this.socket.on('slot_updated', state => this.setState({ lobbyState: state }));
		this.socket.on('game_started', ({ gameId }) => {
			browserHistory.push(`/game/${gameId}`);
		});
		this.socket.on('lobby_error', msg => {
			this.setState({ error: msg, starting: false });
		});
		this.socket.on('connect', () => {
			// Only emit join_room once we have the roomCode from the REST call
			if (this._roomCode) {
				this.socket.emit('join_room', { roomCode: this._roomCode, gameId: this.gameId, token: this.token });
			}
		});

		// Fetch lobby state first, then join the socket room with the roomCode
		fetch(`${BACKEND}/api/lobby/${this.gameId}`)
			.then(r => r.json())
			.then(state => {
				this.setState({ lobbyState: state });
				this._roomCode = state.roomCode;
				if (this.socket.connected) {
					this.socket.emit('join_room', { roomCode: state.roomCode, gameId: this.gameId, token: this.token });
				}
				// If not yet connected, the 'connect' handler above will send it once connected
			})
			.catch(() => this.setState({ error: 'Failed to load game lobby' }));
	}

	componentWillUnmount() {
		if (this.socket) this.socket.disconnect();
	}

	selectSlot(slot, isEngine = false, engineLevel = 5) {
		if (!this.socket) return;
		this.socket.emit('select_slot', { gameId: this.gameId, slot, isEngine, engineLevel, token: this.token });
	}

	releaseSlot(slot) {
		if (!this.socket) return;
		this.socket.emit('release_slot', { gameId: this.gameId, slot, token: this.token });
	}

	toggleEngine(slot, currentSlot) {
		if (currentSlot.type === 'engine') {
			// Switch back to human
			this.socket.emit('select_slot', { gameId: this.gameId, slot, isEngine: false, token: this.token });
		} else {
			this.selectSlot(slot, true, 5);
		}
	}

	changeEngineLevel(slot, level) {
		this.socket.emit('select_slot', { gameId: this.gameId, slot, isEngine: true, engineLevel: level, token: this.token });
	}

	startGame() {
		if (!this.socket) return;
		this.setState({ starting: true, error: '' });
		this.socket.emit('start_game', { gameId: this.gameId, token: this.token });
	}

	copyCode() {
		const code = this.state.lobbyState && this.state.lobbyState.roomCode;
		if (code) { navigator.clipboard.writeText(code); this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 2000); }
	}

	get isCreator() { return !!(this.state.lobbyState && this.state.lobbyState.creatorId === this.userId); }

	get allSlotsFilled() {
		const slots = this.state.lobbyState && this.state.lobbyState.slots;
		if (!slots) return false;
		return [1, 2, 3, 4].every(s => slots[s] && (slots[s].type === 'human' || slots[s].type === 'engine'));
	}

	renderSlot(slotNum) {
		const { lobbyState } = this.state;
		if (!lobbyState) return null;
		const slot = (lobbyState.slots && lobbyState.slots[slotNum]) || { type: 'empty' };
		const cfg = TEAM_CONFIG[slotNum];
		const isMe = slot.type === 'human' && slot.id === this.userId;
		const mySlot = [1, 2, 3, 4].find(s => lobbyState.slots && lobbyState.slots[s] && lobbyState.slots[s].id === this.userId);
		const canTake = !mySlot || mySlot === slotNum;

		return (
			<div className={`bg-bg-panel border rounded-lg p-4 transition-all ${isMe ? 'border-accent' : 'border-border-dim'}`}>
				<div className="flex items-center justify-between mb-3">
					<div>
						<div className="text-text-dim text-xs font-medium">{cfg.label}</div>
						<div className="text-text-dim text-xs">{cfg.boardLabel}</div>
					</div>
					<span className={`text-xs px-2 py-0.5 rounded font-semibold ${cfg.teamClass}`}>{cfg.team}</span>
				</div>

				{slot.type === 'empty' && (
					<button
						onClick={() => canTake && this.selectSlot(slotNum)}
						disabled={!canTake}
						className={`w-full py-2 rounded-lg text-sm font-medium border border-dashed transition-colors ${
							canTake ? 'border-border-dim text-text-dim hover:border-accent hover:text-text-main cursor-pointer' : 'border-border-dim text-text-dim opacity-40 cursor-not-allowed'
						}`}
					>
						{canTake ? '+ Take this seat' : 'Seat taken by you elsewhere'}
					</button>
				)}

				{slot.type === 'human' && (
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${isMe ? 'bg-accent' : 'bg-accent-blue'}`} />
							<span className="text-text-main font-medium text-sm">{slot.username}</span>
							<span className="text-text-dim text-xs">{slot.rating}</span>
						</div>
						{isMe && (
							<button
								onClick={() => this.releaseSlot(slotNum)}
								className="text-text-dim hover:text-red-400 text-xs transition-colors"
							>
								Leave
							</button>
						)}
					</div>
				)}

				{slot.type === 'engine' && (
					<div>
						<div className="flex items-center justify-between mb-2">
							<span className="text-accent text-sm font-medium">⚡ Stockfish Engine</span>
							{this.isCreator && (
								<button
									onClick={() => this.toggleEngine(slotNum, slot)}
									className="text-text-dim hover:text-red-400 text-xs transition-colors"
								>
									Remove
								</button>
							)}
						</div>
						{this.isCreator && (
							<div>
								<div className="flex justify-between text-xs text-text-dim mb-1">
									<span>Skill Level</span>
									<span className="text-accent font-bold">{slot.level || 5}</span>
								</div>
								<input
									type="range" min="1" max="10" step="1"
									value={slot.level || 5}
									onChange={e => this.changeEngineLevel(slotNum, parseInt(e.target.value))}
									className="w-full accent-orange-500 cursor-pointer"
								/>
								<div className="flex justify-between text-xs text-text-dim mt-0.5">
									<span>Easy</span><span>Hard</span>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Creator can set any empty seat to engine */}
				{slot.type === 'empty' && this.isCreator && (
					<button
						onClick={() => this.selectSlot(slotNum, true, 5)}
						className="w-full mt-2 py-1.5 rounded-lg text-xs font-medium text-accent border border-accent/30 hover:border-accent hover:bg-accent/10 transition-colors"
					>
						Set as Engine
					</button>
				)}
			</div>
		);
	}

	render() {
		const { lobbyState, error, starting, copied } = this.state;
		if (error && !lobbyState) {
			return (
				<div className="bg-bg-base min-h-screen">
					<HeaderContainer />
					<div className="max-w-2xl mx-auto px-6 py-12 text-center text-red-400">{error}</div>
				</div>
			);
		}

		return (
			<div className="bg-bg-base min-h-screen">
				<HeaderContainer />
				<div className="max-w-2xl mx-auto px-6 py-8">
					<div className="flex items-start justify-between mb-6">
						<div>
							<h1 className="text-text-main text-2xl font-bold mb-1">Game Lobby</h1>
							{lobbyState && (
								<p className="text-text-dim text-sm">
									{lobbyState.minutes}+{lobbyState.increment} · Rated
								</p>
							)}
						</div>
						{lobbyState && lobbyState.roomCode && (
							<div className="text-right">
								<div className="text-text-dim text-xs mb-1 font-medium">Room Code</div>
								<button onClick={() => this.copyCode()} className="group flex items-center gap-2">
									<span className="text-3xl font-mono font-bold tracking-widest text-accent">{lobbyState.roomCode}</span>
									<span className="text-text-dim text-xs group-hover:text-text-main transition-colors">
										{copied ? '✓ Copied' : 'Copy'}
									</span>
								</button>
								<div className="text-text-dim text-xs mt-1">Share this with friends</div>
							</div>
						)}
					</div>

					{error && (
						<div className="bg-red-900/20 border border-red-700/40 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
							{error}
						</div>
					)}

					{!lobbyState ? (
						<div className="text-center text-text-dim py-12">Loading lobby…</div>
					) : (
						<div>
							{/* Board layout */}
							<div className="flex gap-4 mb-2">
								<div className="flex-1 text-center text-xs font-semibold text-accent uppercase tracking-wide">Left Board</div>
								<div className="flex-1 text-center text-xs font-semibold text-accent-blue uppercase tracking-wide">Right Board</div>
							</div>
							<div className="flex gap-4 mb-3">
								<div className="flex-1 text-center text-xs"><span className="bg-orange-900/30 text-accent px-2 py-0.5 rounded">Team 1: P1 + P4</span></div>
								<div className="flex-1 text-center text-xs"><span className="bg-blue-900/30 text-accent-blue px-2 py-0.5 rounded">Team 2: P2 + P3</span></div>
							</div>

							<div className="flex gap-4">
								<div className="flex-1 flex flex-col gap-3">
									{this.renderSlot(2)}
									<div className="bg-bg-panel border border-border-dim rounded-lg aspect-square flex items-center justify-center text-text-dim text-sm font-medium select-none">Board 1</div>
									{this.renderSlot(1)}
								</div>
								<div className="flex-1 flex flex-col gap-3">
									{this.renderSlot(3)}
									<div className="bg-bg-panel border border-border-dim rounded-lg aspect-square flex items-center justify-center text-text-dim text-sm font-medium select-none">Board 2</div>
									{this.renderSlot(4)}
								</div>
							</div>

							{this.isCreator && (
								<button
									onClick={() => this.startGame()}
									disabled={!this.allSlotsFilled || starting}
									className={`w-full mt-6 py-3 rounded-lg font-semibold text-white text-base transition-colors ${
										this.allSlotsFilled && !starting ? 'bg-accent hover:bg-orange-400 cursor-pointer' : 'bg-bg-panel text-text-dim cursor-not-allowed'
									}`}
								>
									{starting ? 'Starting…' : this.allSlotsFilled ? 'Start Game' : 'Fill all seats to start'}
								</button>
							)}

							{!this.isCreator && (
								<div className="mt-6 text-center text-text-dim text-sm py-3 border border-border-dim rounded-lg">
									Waiting for the host to start the game…
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}
}
