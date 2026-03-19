import React from 'react';
import GameActionsPanelContainer from '../../../containers/game/sidebar/GameActionsPanelContainer';
import UserLinkComponent from '../../common/UserLinkComponent';

export default class GameInfoPanelComponent extends React.Component {
	constructor(props) {
		super(props);
		this.getInfoFormat = this.getInfoFormat.bind(this);
	}

	getInfoFormat() {
		const { minutes, increment, mode } = this.props.game;
		let speed;
		if (minutes < 3) speed = 'Bullet';
		else if (minutes <= 8) speed = 'Blitz';
		else speed = 'Classical';
		return `${minutes}+${increment} · ${speed} · ${mode}`;
	}

	render() {
		const { game, gameTermination, isPlaying } = this.props;
		return (
			<div className="p-4 border-b border-border-dim flex-shrink-0">
				{/* Time control badge */}
				<div className="text-xs font-medium text-text-dim mb-3">{this.getInfoFormat()}</div>

				{/* Team 1 */}
				<div className="mb-2">
					<div className="text-xs uppercase tracking-wide text-accent font-semibold mb-1">Team 1</div>
					<div className="flex items-center gap-2 text-sm text-text-main">
						<img src="/app/static/img/pieces/wK.svg" alt="" width="16" height="16" />
						<UserLinkComponent user={game.player1} />
					</div>
					<div className="flex items-center gap-2 text-sm text-text-dim mt-0.5">
						<img src="/app/static/img/pieces/bK.svg" alt="" width="16" height="16" />
						<UserLinkComponent user={game.player4} />
					</div>
				</div>

				{/* vs */}
				<div className="text-xs text-text-dim text-center my-1">vs</div>

				{/* Team 2 */}
				<div className="mb-3">
					<div className="text-xs uppercase tracking-wide text-accent-blue font-semibold mb-1">Team 2</div>
					<div className="flex items-center gap-2 text-sm text-text-dim">
						<img src="/app/static/img/pieces/bK.svg" alt="" width="16" height="16" />
						<UserLinkComponent user={game.player2} />
					</div>
					<div className="flex items-center gap-2 text-sm text-text-main mt-0.5">
						<img src="/app/static/img/pieces/wK.svg" alt="" width="16" height="16" />
						<UserLinkComponent user={game.player3} />
					</div>
				</div>

				{gameTermination ? (
					<div className="bg-bg-panel border border-border-dim rounded px-3 py-2 text-text-main text-xs font-medium">
						{gameTermination}
					</div>
				) : (
					isPlaying && <GameActionsPanelContainer />
				)}
			</div>
		);
	}
}
