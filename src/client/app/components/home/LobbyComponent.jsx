import React from 'react';
import axios from 'axios';
import _ from 'lodash';
import { showErrorNotification } from '../../util/notifications';

export default class LobbyComponent extends React.Component {
	constructor(props) {
		super(props);
		this.addPlayer = this.addPlayer.bind(this);
	}

	addPlayer(game) {
		if (_.isEmpty(this.props.currentUser)) {
			showErrorNotification('Please log in to join a game');
		} else if (game.joinRandom) {
			const openSlots = [];
			if (game.player1.id === null) openSlots.push(1);
			if (game.player2.id === null) openSlots.push(2);
			if (game.player3.id === null) openSlots.push(3);
			if (game.player4.id === null) openSlots.push(4);
			const slot = openSlots[Math.floor(Math.random() * openSlots.length)];
			const putData = { player: this.props.currentUser.id, playerPosition: `player${slot}` };
			axios.put(`/api/games/open/${game.id}`, putData)
				.then(() => { this.props.updateSelectedGame(game); })
				.catch(() => { showErrorNotification('You cannot join this game'); });
		} else {
			this.props.updateModalDisplayedGame(game);
			this.props.toggleModalDisplay();
		}
	}

	render() {
		function getSlots(game) {
			let count = 0;
			if (game.player1.id !== null) count++;
			if (game.player2.id !== null) count++;
			if (game.player3.id !== null) count++;
			if (game.player4.id !== null) count++;
			return `${count}/4`;
		}

		function formatPlayer(player, game) {
			if (player.id !== null) {
				let s = player.title ? `${player.title} ` : '';
				s += player.username;
				if (game.minutes < 3) s += ` (${Math.round(player.ratingBullet)})`;
				else if (game.minutes <= 8) s += ` (${Math.round(player.ratingBlitz)})`;
				else s += ` (${Math.round(player.ratingClassical)})`;
				return s;
			}
			return <span className="text-green-500">open</span>;
		}

		function formatRange(game) {
			const idx = game.ratingRange.indexOf('-');
			return `${parseInt(game.ratingRange.substring(0, idx))}–${parseInt(game.ratingRange.substring(idx + 1))}`;
		}

		/* eslint-disable jsx-a11y/no-static-element-interactions */
		return (
			<div className="flex-1 min-w-0">
				<h2 className="text-text-main text-lg font-semibold mb-3">Open Games</h2>
				{this.props.displayedGames.length === 0 ? (
					<p className="text-text-dim text-sm">No open games. Create one!</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm text-text-dim">
							<thead>
								<tr className="border-b border-border-dim text-xs uppercase tracking-wide text-text-dim">
									<th className="text-left pb-2 pr-4">Slots</th>
									<th className="text-left pb-2 pr-4">Time</th>
									<th className="text-left pb-2 pr-4">Mode</th>
									<th className="text-left pb-2 pr-4">Team 1</th>
									<th className="text-left pb-2 pr-4">Team 2</th>
									<th className="text-left pb-2">Rating Range</th>
								</tr>
							</thead>
							<tbody>
								{this.props.displayedGames.map((game, index) => (
									<tr
										key={index}
										onClick={() => this.addPlayer(game)}
										className="border-b border-border-dim hover:bg-bg-hover cursor-pointer transition-colors"
									>
										<td className="py-2 pr-4">{getSlots(game)}</td>
										<td className="py-2 pr-4 text-text-main font-medium">{game.minutes}+{game.increment}</td>
										<td className="py-2 pr-4">
											<span className={`px-1.5 py-0.5 rounded text-xs font-medium ${game.mode === 'Rated' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-panel text-text-dim'}`}>
												{game.mode}
											</span>
										</td>
										<td className="py-2 pr-4">
											<div className="text-xs leading-5">
												<div className={game.player1.id === null ? 'text-green-500' : 'text-text-main'}>{formatPlayer(game.player1, game)}</div>
												<div className={game.player4.id === null ? 'text-green-500' : 'text-text-dim'}>{formatPlayer(game.player4, game)}</div>
											</div>
										</td>
										<td className="py-2 pr-4">
											<div className="text-xs leading-5">
												<div className={game.player2.id === null ? 'text-green-500' : 'text-text-main'}>{formatPlayer(game.player2, game)}</div>
												<div className={game.player3.id === null ? 'text-green-500' : 'text-text-dim'}>{formatPlayer(game.player3, game)}</div>
											</div>
										</td>
										<td className="py-2 text-xs">{formatRange(game)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
		/* eslint-enable jsx-a11y/no-static-element-interactions */
	}
}
