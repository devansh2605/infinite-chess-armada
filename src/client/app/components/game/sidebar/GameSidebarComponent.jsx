import React from 'react';
import GameInfoPanelContainer from '../../../containers/game/sidebar/GameInfoPanelContainer';
import GameMovesPanelContainer from '../../../containers/game/sidebar/GameMovesPanelContainer';

export default class GameSidebarComponent extends React.Component {
	render() {
		return (
			<div
				className="bg-bg-card border-r border-border-dim flex flex-col h-screen overflow-hidden"
				style={{ width: '280px', minWidth: '280px', position: 'relative', zIndex: 1 }}
			>
				<GameInfoPanelContainer />
				<div className="flex-1 overflow-y-auto">
					<GameMovesPanelContainer />
				</div>
			</div>
		);
	}
}
