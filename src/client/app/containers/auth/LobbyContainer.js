import { connect } from 'react-redux';
import LobbyPage from '../../pages/LobbyPage';

function mapStateToProps(state) {
	return { currentUser: state.user.currentUser };
}
export default connect(mapStateToProps)(LobbyPage);
