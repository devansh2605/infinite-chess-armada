import { connect } from 'react-redux';
import LobbyWaitingRoom from '../../pages/LobbyWaitingRoom';

function mapStateToProps(state) {
	return { currentUser: state.user.currentUser };
}
export default connect(mapStateToProps)(LobbyWaitingRoom);
