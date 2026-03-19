import { connect } from 'react-redux';
import LocalGameSetupComponent from '../../components/home/LocalGameSetupComponent';
import { createLocalGame } from '../../actions/game';

function mapStateToProps(state) {
	return {
		currentUser: state.user.currentUser
	};
}

function mapDispatchToProps(dispatch) {
	return {
		createLocalGame: data => dispatch(createLocalGame(data))
	};
}

export default connect(mapStateToProps, mapDispatchToProps)(LocalGameSetupComponent);
