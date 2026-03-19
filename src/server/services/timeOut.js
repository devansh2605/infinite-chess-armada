const Game = require('../models/Game');
const logger = require('../logger');
const engineManager = require('./engineManager');

/**
 * Check if any user has timed out in a game
 * @param {Game} game - Game row from database
 * @returns {String} - Returns empty string if game is still going, otherwise returns termination string
 */
function checkIfTimeOut(game) {
	const currentTime = Date.now();
	for (let userPosition = 1; userPosition <= 4; userPosition++) {
		const boardNum = (userPosition === 1 || userPosition === 2) ? 1 : 2;
		const lastTime = (userPosition === 1 || userPosition === 2) ? game.left_last_time : game.right_last_time;

		// Skip if this board has been drawn (lastTime is null after a draw, or engine manager says so)
		if (lastTime === null || engineManager.isBoardDrawn(game.id, boardNum)) {
			continue;
		}

		const diffTime = currentTime - lastTime;
		if (diffTime + game.clocks.split(',').map(Number)[userPosition - 1] >= game.minutes * 1000 * 60) {
			if (userPosition === 1 || userPosition === 4) {
				return 'Team 1 timed out, Team 2 is victorious';
			} else if (userPosition === 2 || userPosition === 3) {
				return 'Team 2 timed out, Team 1 is victorious';
			}
		}
	}
	return '';
}

module.exports = async (id, socket, gameSocket, clearRoom) => {
	try {
		const game = await Game.getByID(id);
		if (game && game.status === 'playing') {
			const termination = checkIfTimeOut(game);
			if (termination) {
				await Game.endGame(game, termination, socket, gameSocket, clearRoom);
			}
		}
	} catch (err) {
		logger.error(`Error handling timeOut for game id ${id}: ${err}`);
	}
};
