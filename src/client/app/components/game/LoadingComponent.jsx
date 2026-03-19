import React from 'react';
import axios from 'axios';
import { browserHistory } from 'react-router';
import { socketLobby } from '../../socket';

export default class LoadingComponent extends React.Component {
	constructor(props) {
		super(props);
		this.handleUserLeaveGame = this.handleUserLeaveGame.bind(this);
	}

	componentWillMount() {
		window.addEventListener('beforeunload', this.handleUserLeaveGame);
	}

	componentWillUnmount() {
		if (this.props.userWaitingForGameToStart) {
			this.handleUserLeaveGame();
		}
		window.removeEventListener('beforeunload', this.handleUserLeaveGame);
	}

	handleUserLeaveGame() {
		axios.put('/api/games/remove', {
			token: localStorage.getItem('token'),
			gameID: this.props.selectedGameID
		}).then(() => {
			socketLobby.emit('update game list');
			this.props.toggleUserWaitingForGameToStart();
			browserHistory.push('/');
		});
	}

	render() {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-bg-base gap-6">
				{/* Spinner */}
				<div className="relative w-20 h-20">
					<div className="absolute inset-0 rounded-full border-4 border-bg-panel" />
					<div className="absolute inset-0 rounded-full border-4 border-t-accent animate-spin" />
					<div className="absolute inset-2 rounded-full border-4 border-r-accent-blue animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
				</div>
				<p className="text-text-dim text-sm">Waiting for other players to join...</p>
				<button
					onClick={this.handleUserLeaveGame}
					className="px-5 py-2 rounded border border-border-dim text-text-dim text-sm hover:border-red-500 hover:text-red-400 transition-colors"
				>
					Cancel game
				</button>
			</div>
		);
	}
}
