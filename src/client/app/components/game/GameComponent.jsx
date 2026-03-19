import React from 'react';
import axios from 'axios';
import { browserHistory } from 'react-router';
import GameSidebarComponent from './sidebar/GameSidebarComponent';
import GameBoardsContainer from '../../containers/game/boards/GameBoardsContainer';

export default class GameComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = { renderGameBoards: false, resuming: false };
		this.handleResume = this.handleResume.bind(this);
	}

	componentWillMount() {
		this.props.getGameInfo(this.props.params.splat);
	}

	componentWillReceiveProps(nextProps) {
		this.setState({ renderGameBoards: nextProps.renderGameBoards });
	}

	handleResume() {
		this.setState({ resuming: true });
		axios.post(`/api/games/resume/${this.props.gameId}`)
			.then(() => {
				// Re-mount by navigating to same route — re-hydrates clocks
				browserHistory.replace(`/game/${this.props.gameId}`);
			})
			.catch(() => this.setState({ resuming: false }));
	}

	render() {
		const { gamePaused } = this.props;
		return (
			<div className="flex bg-bg-base min-h-screen">
				{this.state.renderGameBoards && (
					<div className="flex flex-1 min-w-0">
						<GameSidebarComponent />
						<div style={{ position: 'relative', flex: 1, overflow: 'visible' }}>
							<GameBoardsContainer isPlaying={this.props.isPlaying} />
							{gamePaused && (
								<div style={resumeOverlayStyle}>
									<div style={resumeCardStyle}>
										<div style={{ marginBottom: '12px', color: '#e2e8f0', fontWeight: 'bold', fontSize: '16px' }}>Game Paused</div>
										<button
											style={resumeButtonStyle}
											onClick={this.handleResume}
											disabled={this.state.resuming}
										>
											{this.state.resuming ? 'Starting…' : '▶ Start Game'}
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		);
	}
}

const resumeOverlayStyle = {
	position: 'absolute',
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	backgroundColor: 'rgba(0,0,0,0.7)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 200
};

const resumeCardStyle = {
	backgroundColor: '#1a1a1a',
	border: '1px solid #3d3d3d',
	borderRadius: '8px',
	padding: '24px 32px',
	textAlign: 'center'
};

const resumeButtonStyle = {
	cursor: 'pointer',
	padding: '10px 28px',
	borderRadius: '5px',
	border: 'none',
	backgroundColor: '#f97316',
	color: '#fff',
	fontSize: '15px',
	fontWeight: 'bold'
};
