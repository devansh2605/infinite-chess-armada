import io from 'socket.io-client';
import { browserHistory } from 'react-router';
import store from './index';
import { updateDisplayResignChoice, updateDisplayDrawChoice, updateGameTermination, fetchPostGameData } from './actions/game';
import playSound from './util/sound';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export const socketLobby = io(BACKEND + '/lobby', { autoConnect: false });
export const socketGame = io(BACKEND + '/game', { autoConnect: false });

// Connect game socket (connect lazily when needed)
socketGame.connect();

function onSameTeam(p1, p2) {
	return (p1 === 1 && p2 === 4) || (p1 === 2 && p2 === 3) || (p1 === 3 && p2 === 2) || (p1 === 4 && p2 === 1) || (p1 === p2);
}

socketGame.on('offer resign', resigningUserPosition => {
	const state = store.getState().game;
	if (state.localMode) return;
	if (onSameTeam(state.userPosition, resigningUserPosition)) {
		store.dispatch(updateDisplayResignChoice(true));
	}
});

socketGame.on('offer draw', () => {
	if (store.getState().game.localMode) return;
	store.dispatch(updateDisplayDrawChoice(true));
});

socketGame.on('decline resign', decliningUserPosition => {
	const state = store.getState().game;
	if (state.localMode) return;
	if (onSameTeam(state.userPosition, decliningUserPosition)) store.dispatch(updateDisplayResignChoice(false));
});

socketGame.on('decline draw', () => {
	if (store.getState().game.localMode) return;
	store.dispatch(updateDisplayDrawChoice(false));
});

socketGame.on('game over', ({ termination, ratingDeltas }) => {
	store.dispatch(updateGameTermination(termination));
	// Fetch rating history from API to populate post-game modal
	const gameState = store.getState().game;
	const gameId = gameState && gameState.game && gameState.game.id;
	if (gameId) store.dispatch(fetchPostGameData(gameId));
	playSound('notify');
});
