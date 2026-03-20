import axios from 'axios';
import { showErrorNotification } from '../util/notifications';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export const REQUEST_LEADERBOARD = 'REQUEST_LEADERBOARD';
export const RECEIVE_LEADERBOARD = 'RECEIVE_LEADERBOARD';

function requestLeaderboard() {
	return { type: REQUEST_LEADERBOARD };
}

function receiveLeaderboard(data) {
	return { type: RECEIVE_LEADERBOARD, data };
}

function shouldFetchLeaderboard(state) {
	return !state.leaderboard.hasFetched && !state.leaderboard.isFetching;
}

function fetchLeaderboard() {
	return dispatch => {
		dispatch(requestLeaderboard());
		return axios.get(`${BACKEND}/api/ratings/leaderboard`)
			.then(response => dispatch(receiveLeaderboard({
				bullet: response.data,
				blitz: response.data,
				classical: response.data
			})))
			.catch(() => {
				showErrorNotification('Failed to fetch leaderboard');
			});
	};
}

export function fetchLeaderboardIfNeeded() {
	return (dispatch, getState) => {
		if (shouldFetchLeaderboard(getState())) {
			return dispatch(fetchLeaderboard());
		}
		return Promise.resolve();
	};
}
