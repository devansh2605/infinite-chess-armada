import React from 'react';
import axios from 'axios';
import _ from 'lodash';
import HeaderContainer from '../../containers/header/HeaderContainer';

const PRESETS = [
	{ label: '1+0', minutes: 1, increment: 0 },
	{ label: '3+2', minutes: 3, increment: 2 },
	{ label: '5+5', minutes: 5, increment: 5 },
	{ label: '10+0', minutes: 10, increment: 0 },
	{ label: 'Custom', minutes: null, increment: null }
];

export default class LocalGameSetupComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			preset: '5+5',
			minutes: 5,
			increment: 5,
			customMinutes: 5,
			customIncrement: 5,
			allUsers: [],
			slots: {
				player1: props.currentUser ? props.currentUser.id : null,
				player2: null,
				player3: null,
				player4: null
			},
			engineSlots: {
				player1: false,
				player2: false,
				player3: false,
				player4: false
			},
			engineLevels: {
				player1: 5,
				player2: 5,
				player3: 5,
				player4: 5
			}
		};
		this.handlePresetSelect = this.handlePresetSelect.bind(this);
		this.handlePlayerSelect = this.handlePlayerSelect.bind(this);
		this.handleEngineToggle = this.handleEngineToggle.bind(this);
		this.startGame = this.startGame.bind(this);
	}

	componentDidMount() {
		axios.get('/api/users/').then(res => this.setState({ allUsers: res.data }));
	}

	handlePresetSelect(p) {
		if (p.minutes !== null) {
			this.setState({ preset: p.label, minutes: p.minutes, increment: p.increment });
		} else {
			this.setState({ preset: 'Custom' });
		}
	}

	handleCustomChange(field, val) {
		const n = Math.max(0, parseInt(val) || 0);
		if (field === 'minutes') this.setState({ customMinutes: n, minutes: n });
		else this.setState({ customIncrement: n, increment: n });
	}

	handlePlayerSelect(position, userId) {
		const slots = { ...this.state.slots };
		slots[position] = userId ? parseInt(userId) : null;
		this.setState({ slots });
	}

	handleEngineToggle(position) {
		const engineSlots = { ...this.state.engineSlots };
		const slots = { ...this.state.slots };
		engineSlots[position] = !engineSlots[position];
		if (engineSlots[position]) {
			slots[position] = this.props.currentUser.id;
		} else if (position !== 'player1') {
			slots[position] = null;
		}
		this.setState({ engineSlots, slots });
	}

	handleEngineLevelChange(position, level) {
		const engineLevels = { ...this.state.engineLevels };
		engineLevels[position] = parseInt(level);
		this.setState({ engineLevels });
	}

	getAvailableUsers(currentPosition) {
		const selectedIds = Object.keys(this.state.slots)
			.filter(pos => pos !== currentPosition && this.state.slots[pos] !== null)
			.map(pos => this.state.slots[pos]);
		return this.state.allUsers.filter(u => !selectedIds.includes(u.id));
	}

	allSlotsFilled() {
		const { slots } = this.state;
		return slots.player1 && slots.player2 && slots.player3 && slots.player4;
	}

	startGame() {
		const { slots, minutes, increment, engineSlots, engineLevels } = this.state;
		const enginePlayers = {};
		const engineSkillLevels = {};
		if (engineSlots.player1) { enginePlayers[1] = true; engineSkillLevels[1] = engineLevels.player1; }
		if (engineSlots.player2) { enginePlayers[2] = true; engineSkillLevels[2] = engineLevels.player2; }
		if (engineSlots.player3) { enginePlayers[3] = true; engineSkillLevels[3] = engineLevels.player3; }
		if (engineSlots.player4) { enginePlayers[4] = true; engineSkillLevels[4] = engineLevels.player4; }
		this.props.createLocalGame({
			player1: slots.player1, player2: slots.player2,
			player3: slots.player3, player4: slots.player4,
			minutes, increment,
			token: localStorage.getItem('token'),
			enginePlayers,
			engineSkillLevels
		});
	}

	renderSlot(position, label, teamBadgeClass, teamLabel, isCreator) {
		const userId = this.state.slots[position];
		const isEngine = this.state.engineSlots[position];
		const availableUsers = this.getAvailableUsers(position);

		return (
			<div className="bg-bg-panel border border-border-dim rounded-lg p-3">
				<div className="flex items-center justify-between mb-2">
					<span className="text-text-dim text-xs uppercase tracking-wide font-medium">{label}</span>
					<span className={`text-xs px-2 py-0.5 rounded font-medium ${teamBadgeClass}`}>{teamLabel}</span>
				</div>
				<div className="flex rounded overflow-hidden border border-border-dim mb-2 text-xs font-medium">
					<button
						onClick={() => { if (isEngine) this.handleEngineToggle(position); }}
						className={`flex-1 py-1 transition-colors ${!isEngine ? 'bg-accent-blue text-white' : 'bg-bg-card text-text-dim hover:bg-bg-hover'}`}
					>
						Human
					</button>
					<button
						onClick={() => { if (!isEngine) this.handleEngineToggle(position); }}
						className={`flex-1 py-1 transition-colors ${isEngine ? 'bg-accent text-white' : 'bg-bg-card text-text-dim hover:bg-bg-hover'}`}
					>
						Engine
					</button>
				</div>
				{isEngine ? (
					<div>
						<div className="text-text-dim text-sm px-1 mb-2">Stockfish</div>
						<div className="px-1">
							<div className="flex items-center justify-between mb-1">
								<label className="text-text-dim text-xs">Skill Level</label>
								<span className="text-accent text-xs font-bold">{this.state.engineLevels[position]}</span>
							</div>
							<input
								type="range" min="1" max="10" step="1"
								value={this.state.engineLevels[position]}
								onChange={e => this.handleEngineLevelChange(position, e.target.value)}
								className="w-full accent-orange-500 cursor-pointer"
							/>
							<div className="flex justify-between text-xs text-text-dim mt-0.5">
								<span>1 Easy</span>
								<span>10 Hard</span>
							</div>
						</div>
					</div>
				) : isCreator ? (
					<div className="text-text-main text-sm px-1">{this.props.currentUser.username}</div>
				) : (
					<select
						value={userId || ''}
						onChange={e => this.handlePlayerSelect(position, e.target.value)}
						className="w-full bg-bg-card border border-border-dim rounded px-2 py-1 text-text-main text-sm focus:outline-none focus:border-accent"
					>
						<option value="">— Select player —</option>
						{availableUsers.map(u => (
							<option key={u.id} value={u.id}>{u.username}</option>
						))}
					</select>
				)}
			</div>
		);
	}

	render() {
		if (_.isEmpty(this.props.currentUser)) {
			return (
				<div className="bg-bg-base min-h-screen">
					<HeaderContainer />
					<p className="text-text-dim px-6 py-8">Please log in first.</p>
				</div>
			);
		}

		const isCustom = this.state.preset === 'Custom';

		return (
			<div className="bg-bg-base min-h-screen">
				<HeaderContainer />
				<div className="max-w-2xl mx-auto px-6 py-8">
					<h1 className="text-text-main text-2xl font-bold mb-6">New Local Game</h1>

					{/* Time control */}
					<div className="bg-bg-card border border-border-dim rounded-lg p-5 mb-6">
						<h2 className="text-text-main text-sm font-semibold uppercase tracking-wide mb-3">Time Control</h2>
						<div className="flex flex-wrap gap-2">
							{PRESETS.map(p => (
								<button
									key={p.label}
									onClick={() => this.handlePresetSelect(p)}
									className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
										this.state.preset === p.label
											? 'bg-accent border-accent text-white'
											: 'border-border-dim text-text-dim hover:border-accent hover:text-text-main'
									}`}
								>
									{p.label}
								</button>
							))}
						</div>
						{isCustom && (
							<div className="flex gap-4 mt-4">
								<div className="flex-1">
									<label className="block text-text-dim text-xs mb-1">Minutes</label>
									<input
										type="number" min="1" max="60"
										value={this.state.customMinutes}
										onChange={e => this.handleCustomChange('minutes', e.target.value)}
										className="w-full bg-bg-panel border border-border-dim rounded px-3 py-1.5 text-text-main text-sm focus:outline-none focus:border-accent"
									/>
								</div>
								<div className="flex-1">
									<label className="block text-text-dim text-xs mb-1">Increment (sec)</label>
									<input
										type="number" min="0" max="60"
										value={this.state.customIncrement}
										onChange={e => this.handleCustomChange('increment', e.target.value)}
										className="w-full bg-bg-panel border border-border-dim rounded px-3 py-1.5 text-text-main text-sm focus:outline-none focus:border-accent"
									/>
								</div>
							</div>
						)}
					</div>

					{/* Board grid */}
					<div className="flex gap-3 mb-2">
						<div className="flex-1 text-center text-xs font-semibold text-accent uppercase tracking-wide">Left Board</div>
						<div className="flex-1 text-center text-xs font-semibold text-accent-blue uppercase tracking-wide">Right Board</div>
					</div>
					<div className="flex gap-3 mb-3">
						<div className="flex-1 text-center text-xs">
							<span className="bg-orange-900/30 text-accent px-2 py-0.5 rounded">Team 1: P1 + P4</span>
						</div>
						<div className="flex-1 text-center text-xs">
							<span className="bg-blue-900/30 text-accent-blue px-2 py-0.5 rounded">Team 2: P2 + P3</span>
						</div>
					</div>
					<div className="flex gap-3">
						<div className="flex-1 flex flex-col gap-2">
							{this.renderSlot('player2', 'Player 2 — Black', 'bg-blue-900/30 text-accent-blue', 'Team 2', false)}
							<div className="bg-bg-panel border border-border-dim rounded-lg aspect-square flex items-center justify-center text-text-dim text-sm font-medium select-none">
								Board 1
							</div>
							{this.renderSlot('player1', 'Player 1 — White', 'bg-orange-900/30 text-accent', 'Team 1', true)}
						</div>
						<div className="flex-1 flex flex-col gap-2">
							{this.renderSlot('player3', 'Player 3 — White', 'bg-blue-900/30 text-accent-blue', 'Team 2', false)}
							<div className="bg-bg-panel border border-border-dim rounded-lg aspect-square flex items-center justify-center text-text-dim text-sm font-medium select-none">
								Board 2
							</div>
							{this.renderSlot('player4', 'Player 4 — Black', 'bg-orange-900/30 text-accent', 'Team 1', false)}
						</div>
					</div>

					<button
						onClick={this.allSlotsFilled() ? this.startGame : undefined}
						disabled={!this.allSlotsFilled()}
						className={`w-full mt-6 py-3 rounded-lg font-semibold text-white text-base transition-colors ${
							this.allSlotsFilled()
								? 'bg-accent hover:bg-orange-400 cursor-pointer'
								: 'bg-bg-panel text-text-dim cursor-not-allowed'
						}`}
					>
						Start Game
					</button>
				</div>
			</div>
		);
	}
}
