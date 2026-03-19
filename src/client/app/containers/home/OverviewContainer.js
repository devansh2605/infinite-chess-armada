import { connect } from 'react-redux';
import OverviewComponent from '../../components/home/OverviewComponent';
import { updateDisplayedGames } from '../../actions/lobby';
import { setLocalMode } from '../../actions/game';

function mapDispatchToProps(dispatch) {
	return {
		updateDisplayedGames: () => dispatch(updateDisplayedGames()),
		setLocalMode: (playerTokens, enginePlayers) => dispatch(setLocalMode(playerTokens, enginePlayers))
	};
}

export default connect(null, mapDispatchToProps)(OverviewComponent);
