import axios from 'axios';
import { browserHistory } from 'react-router';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export const UPDATE_MOVES = 'UPDATE_MOVES';
export const UPDATE_CLOCKS = 'UPDATE_CLOCKS';
export const UPDATE_RESERVES = 'UPDATE_RESERVES';
export const UPDATE_PIECE_TO_DRAG_FROM_RESERVE = 'UPDATE_PIECE_TO_DRAG_FROM_RESERVE';
export const RECEIVE_GAME_INFO = 'RECEIVE_GAME_INFO';
export const RECEIVE_IS_PLAYING = 'RECEIVE_IS_PLAYING';
export const UPDATE_DISPLAY_RESIGN_CHOICE = 'UPDATE_DISPLAY_RESIGN_CHOICE';
export const UPDATE_DISPLAY_DRAW_CHOICE = 'UPDATE_DISPLAY_DRAW_CHOICE';
export const UPDATE_GAME_TERMINATION = 'UPDATE_GAME_TERMINATION';
export const UPDATE_POST_GAME_DATA = 'UPDATE_POST_GAME_DATA';
export const RESET_GAME_STATE = 'RESET_GAME_STATE';
export const SET_LOCAL_MODE = 'SET_LOCAL_MODE';

export const updateMoves = moves => ({ type: UPDATE_MOVES, moves });
export const updateClocks = clocks => ({ type: UPDATE_CLOCKS, clocks });
export const updateReserves = (leftWhite, leftBlack, rightWhite, rightBlack) => ({ type: UPDATE_RESERVES, leftWhite, leftBlack, rightWhite, rightBlack });
export const updatePieceToDragFromReserve = piece => ({ type: UPDATE_PIECE_TO_DRAG_FROM_RESERVE, piece });
export const receiveGameInfo = (data, userPosition) => ({ type: RECEIVE_GAME_INFO, data, userPosition });
export const updateDisplayResignChoice = display => ({ type: UPDATE_DISPLAY_RESIGN_CHOICE, display });
export const updateDisplayDrawChoice = display => ({ type: UPDATE_DISPLAY_DRAW_CHOICE, display });
export const updateGameTermination = gameTermination => ({ type: UPDATE_GAME_TERMINATION, gameTermination });
export const updatePostGameData = postGameData => ({ type: UPDATE_POST_GAME_DATA, postGameData });
export const receiveIsPlaying = isPlaying => ({ type: RECEIVE_IS_PLAYING, isPlaying });
export const resetGameState = () => ({ type: RESET_GAME_STATE });
export const setLocalMode = (playerTokens, enginePlayers) => ({ type: SET_LOCAL_MODE, playerTokens, enginePlayers });

function getToken() {
	try {
		const appStore = require('../index').default;
		const state = appStore.getState();
		const user = state && state.user && state.user.currentUser;
		return (user && user.token) || localStorage.getItem('token');
	} catch (err) { return localStorage.getItem('token'); }
}

export function updateIsPlaying(gameID) {
	return (dispatch, getState) => {
		if (getState().game.localMode) { dispatch(receiveIsPlaying(true)); return; }
		const token = getToken();
		axios.put(BACKEND + '/api/games/userIsPlayingOrObserving/' + gameID, { token },
			{ validateStatus: s => (s >= 200 && s < 300) || s === 401 || s === 403 })
			.then(res => dispatch(receiveIsPlaying(res.data.isPlaying)))
			.catch(() => browserHistory.push('/local'));
	};
}

export function getGameInfo(id) {
	return (dispatch, getState) => {
		const token = getToken();
		const lobby = getState().lobby;
		const selectedGame = lobby && lobby.selectedGame;
		const gameId = (selectedGame && selectedGame.id) || id;
		axios.put(BACKEND + '/api/games/withUsers/' + gameId, { token })
			.then(res => dispatch(receiveGameInfo(res.data, res.data.userPosition || 1)));
	};
}

export function fetchPostGameData(gameId) {
	return dispatch => {
		axios.get(BACKEND + '/api/ratings/history?gameId=' + gameId)
			.then(res => {
				const deltas = {};
				(res.data || []).forEach(row => {
					const username = row.profile && row.profile.username;
					deltas[row.slot] = { oldRating: row.rating_before, newRating: row.rating_after, delta: row.rating_after - row.rating_before, username };
				});
				dispatch(updatePostGameData(deltas));
			})
			.catch(() => {});
	};
}
