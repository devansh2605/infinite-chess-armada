import { connect } from 'react-redux';
import _ from 'lodash';
import { getGameInfo } from '../../actions/game';
import GameComponent from '../../components/game/GameComponent';

function mapStateToProps(state) {
	return {
		isPlaying: state.game.isPlaying,
		renderGameBoards: !_.isEmpty(state.game.game),
		gamePaused: !_.isEmpty(state.game.game) && state.game.game.status === 'paused',
		gameId: state.game.game && state.game.game.id,
		localMode: state.game.localMode,
		gameTermination: state.game.gameTermination,
		postGameData: state.game.postGameData,
		game: state.game.game,
	};
}

function mapDispatchToProps(dispatch) {
	return {
		getGameInfo: id => dispatch(getGameInfo(id)),
	};
}

export default connect(mapStateToProps, mapDispatchToProps)(GameComponent);
