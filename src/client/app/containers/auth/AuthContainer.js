import { connect } from 'react-redux';
import AuthPage from '../../pages/AuthPage';
import { updateCurrentUser } from '../../actions/user';

function mapStateToProps(state) {
	return { currentUser: state.user.currentUser };
}
function mapDispatchToProps(dispatch) {
	return {
		setUser: user => {
			localStorage.setItem('token', user.token || '');
			dispatch(updateCurrentUser(user));
		}
	};
}
export default connect(mapStateToProps, mapDispatchToProps)(AuthPage);
