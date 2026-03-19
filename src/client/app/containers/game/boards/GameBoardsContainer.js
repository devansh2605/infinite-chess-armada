import { connect } from 'react-redux';
import GameBoardsComponent from '../../../components/game/boards/GameBoardsComponent';
import {
	updateMoves,
	updateClocks,
	updateReserves,
	updatePieceToDragFromReserve,
	updateDisplayResignChoice,
	updateDisplayDrawChoice,
	updateGameTermination,
	resetGameState } from '../../../actions/game';

function mapStateToProps(state) {
	const localMode = state.game.localMode;
	const userPosition = localMode ? 1 : state.game.userPosition;
	const game = state.game.game;
	const display = {};
	if (userPosition === 1) {
		display.player1 = game.player1;
		display.player2 = game.player2;
		display.player3 = game.player3;
		display.player4 = game.player4;
	} else if (userPosition === 2) {
		display.player1 = game.player2;
		display.player2 = game.player1;
		display.player3 = game.player4;
		display.player4 = game.player3;
	} else if (userPosition === 3) {
		display.player1 = game.player3;
		display.player2 = game.player4;
		display.player3 = game.player1;
		display.player4 = game.player2;
	} else {
		display.player1 = game.player4;
		display.player2 = game.player3;
		display.player3 = game.player2;
		display.player4 = game.player1;
	}
	return {
		game,
		display,
		userPosition,
		localMode,
		playerTokens: state.game.playerTokens,
		enginePlayers: state.game.enginePlayers,
		gameTermination: state.game.gameTermination,
		moves: state.game.moves,
		clocks: state.game.clocks,
		pieceToDragFromReserve: state.game.pieceToDragFromReserve,
		user: state.user.currentUser
	};
}

function mapDispatchToProps(dispatch) {
	return {
		updateMoves: moves => dispatch(updateMoves(moves)),
		updateClocks: clocks => dispatch(updateClocks(clocks)),
		updateReserves: (leftWhite, leftBlack, rightWhite, rightBlack) => dispatch(updateReserves(leftWhite, leftBlack, rightWhite, rightBlack)),
		updatePieceToDragFromReserve: piece => dispatch(updatePieceToDragFromReserve(piece)),
		updateDisplayResignChoice: display => dispatch(updateDisplayResignChoice(display)),
		updateDisplayDrawChoice: display => dispatch(updateDisplayDrawChoice(display)),
		updateGameTermination: gameTermination => dispatch(updateGameTermination(gameTermination)),
		resetGameState: () => dispatch(resetGameState())
	};
}

export default connect(mapStateToProps, mapDispatchToProps)(GameBoardsComponent);
