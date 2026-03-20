const Game = require('../models/Game');
const Bug = require('./bug');
const supabase = require('../lib/supabaseAdmin');

// Per-game async mutex: prevents concurrent read-modify-write races
// (board shuffling / can't-move bugs caused by engine + human moves overlapping)
const gameLocks = {};

async function acquireGameLock(gameId) {
	let releaseLock;
	const lockPromise = new Promise(resolve => { releaseLock = resolve; });
	const prev = gameLocks[gameId] || Promise.resolve();
	gameLocks[gameId] = prev.then(() => lockPromise);
	await prev;
	return releaseLock;
}

function newMoveString(moves, userPosition, game) {
	if (!moves) moves = '';
	let moveCount;
	let lastPlayerLetter;
	if (userPosition === 1) lastPlayerLetter = moves.lastIndexOf('A.');
	else if (userPosition === 2) lastPlayerLetter = moves.lastIndexOf('a.');
	else if (userPosition === 3) lastPlayerLetter = moves.lastIndexOf('B.');
	else lastPlayerLetter = moves.lastIndexOf('b.');
	if (lastPlayerLetter === -1) moveCount = 1;
	else {
		const lastSpace = moves.substring(0, lastPlayerLetter).lastIndexOf(' ');
		const loopSubstring = moves.substring(lastSpace + 1, lastPlayerLetter);
		let beginNum = 0;
		for (; beginNum < loopSubstring.length; beginNum++) {
			if (!isNaN(loopSubstring[beginNum])) break;
		}
		moveCount = parseInt(moves.substring(lastSpace + beginNum + 1, lastPlayerLetter)) + 1;
	}
	if (userPosition === 1) moves += `${moveCount}A. ${game.history()} `;
	else if (userPosition === 2) moves += `${moveCount}a. ${game.history()} `;
	else if (userPosition === 3) moves += `${moveCount}B. ${game.history()} `;
	else moves += `${moveCount}b. ${game.history()} `;
	return { moves, moveNum: moveCount };
}

function convertReserveToSparePieces(reserve) {
	return JSON.parse(reserve).map(row => {
		const letters = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
		return { role: letters[row.type], color: row.color === 'w' ? 'white' : 'black' };
	});
}

function convertPieceToSANLetter(piece) {
	const mapping = { pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q' };
	return mapping[piece];
}

module.exports = async (data, socket, gameSocket, clearRoom) => {
	const releaseLock = await acquireGameLock(data.id);
	try {
		const row = await Game.getByID(data.id);
		const currentTime = Date.now();
		row.left_reserve_white = row.left_reserve_white ? JSON.parse(row.left_reserve_white) : [];
		row.left_reserve_black = row.left_reserve_black ? JSON.parse(row.left_reserve_black) : [];
		row.right_reserve_white = row.right_reserve_white ? JSON.parse(row.right_reserve_white) : [];
		row.right_reserve_black = row.right_reserve_black ? JSON.parse(row.right_reserve_black) : [];
		row.left_promoted_pieces = row.left_promoted_pieces ? JSON.parse(row.left_promoted_pieces) : [];
		row.right_promoted_pieces = row.right_promoted_pieces ? JSON.parse(row.right_promoted_pieces) : [];
		row.left_fens = row.left_fens.split(',');
		row.right_fens = row.right_fens.split(',');

		let game, move;
		if (data.userPosition === 1 || data.userPosition === 2) {
			game = new Bug(row.left_fens[row.left_fens.length - 1]);
			game.setReserves(row.left_reserve_white, row.left_reserve_black);
			game.setPromotedPieceSquares(row.left_promoted_pieces);
		} else {
			game = new Bug(row.right_fens[row.right_fens.length - 1]);
			game.setReserves(row.right_reserve_white, row.right_reserve_black);
			game.setPromotedPieceSquares(row.right_promoted_pieces);
		}

		let lastMove = [data.move.target];
		if (data.move.source === 'spare') {
			move = game.move(`${convertPieceToSANLetter(data.move.piece.role)}@${data.move.target}`);
		} else {
			move = game.move({ from: data.move.source, to: data.move.target, promotion: data.move.promotion });
			lastMove.push(data.move.source);
		}
		lastMove = JSON.stringify(lastMove);

		if (move) {
			const isPromotion = data.move.promotion !== null;
			const turn = game.turn() === 'w' ? 'white' : 'black';
			const capture = game.history()[0].indexOf('x') !== -1;
			const newReserves = game.getReserves();
			const moveInfo = newMoveString(row.moves, data.userPosition, game);
			const argMoves = moveInfo.moves;
			const moveNum = moveInfo.moveNum;
			const argReserveWhite = JSON.stringify(newReserves.reserve_white);
			const argReserveBlack = JSON.stringify(newReserves.reserve_black);
			const arrClocks = row.clocks.split(',').map(Number);
			row.increment *= 1000;

			let updatePayload, emitData, boardNum, diffTime;
			let leftPromotedPieces = row.left_promoted_pieces;
			let rightPromotedPieces = row.right_promoted_pieces;

			if (data.userPosition === 1 || data.userPosition === 2) {
				boardNum = 1;
				const argOtherReserveWhite = JSON.stringify(row.right_reserve_white.concat(newReserves.other_reserve_white));
				const argOtherReserveBlack = JSON.stringify(row.right_reserve_black.concat(newReserves.other_reserve_black));
				row.left_fens.push(game.fen());
				const argFen = row.left_fens.join();
				diffTime = moveNum === 1 && turn === 'black' ? row.increment : currentTime - row.left_last_time;
				if (data.userPosition === 1) arrClocks[0] += diffTime - row.increment;
				else arrClocks[1] += diffTime - row.increment;

				if (isPromotion) leftPromotedPieces.push(data.move.target);
				else if (capture && leftPromotedPieces.includes(data.move.target)) leftPromotedPieces = leftPromotedPieces.filter(i => i !== data.move.target);
				else if (leftPromotedPieces.includes(data.move.source)) { leftPromotedPieces = leftPromotedPieces.filter(i => i !== data.move.source); leftPromotedPieces.push(data.move.target); }

				updatePayload = {
					left_fens: argFen,
					left_reserve_white: argReserveWhite,
					left_reserve_black: argReserveBlack,
					right_reserve_white: argOtherReserveWhite,
					right_reserve_black: argOtherReserveBlack,
					left_last_time: currentTime,
					moves: argMoves,
					clocks: arrClocks.join(','),
					left_last_move: lastMove,
					left_color_to_play: turn,
					left_promoted_pieces: JSON.stringify(leftPromotedPieces),
				};
				emitData = {
					fens: row.left_fens, boardNum, turn, capture, move: data.move, moves: argMoves, clocks: arrClocks,
					leftReserveWhite: convertReserveToSparePieces(argReserveWhite),
					leftReserveBlack: convertReserveToSparePieces(argReserveBlack),
					rightReserveWhite: convertReserveToSparePieces(argOtherReserveWhite),
					rightReserveBlack: convertReserveToSparePieces(argOtherReserveBlack),
				};
			} else {
				boardNum = 2;
				const argOtherReserveWhite = JSON.stringify(row.left_reserve_white.concat(newReserves.other_reserve_white));
				const argOtherReserveBlack = JSON.stringify(row.left_reserve_black.concat(newReserves.other_reserve_black));
				row.right_fens.push(game.fen());
				const argFen = row.right_fens.join();
				diffTime = moveNum === 1 && turn === 'black' ? row.increment : currentTime - row.right_last_time;
				if (data.userPosition === 3) arrClocks[2] += diffTime - row.increment;
				else arrClocks[3] += diffTime - row.increment;

				if (isPromotion) rightPromotedPieces.push(data.move.target);
				else if (capture && rightPromotedPieces.includes(data.move.target)) rightPromotedPieces = rightPromotedPieces.filter(i => i !== data.move.target);
				else if (rightPromotedPieces.includes(data.move.source)) { rightPromotedPieces = rightPromotedPieces.filter(i => i !== data.move.source); rightPromotedPieces.push(data.move.target); }

				updatePayload = {
					right_fens: argFen,
					right_reserve_white: argReserveWhite,
					right_reserve_black: argReserveBlack,
					left_reserve_white: argOtherReserveWhite,
					left_reserve_black: argOtherReserveBlack,
					moves: argMoves,
					right_last_time: currentTime,
					clocks: arrClocks.join(','),
					right_last_move: lastMove,
					right_color_to_play: turn,
					right_promoted_pieces: JSON.stringify(rightPromotedPieces),
				};
				emitData = {
					fens: row.right_fens, boardNum, turn, capture, moveNum, move: data.move, moves: argMoves, clocks: arrClocks,
					leftReserveWhite: convertReserveToSparePieces(argOtherReserveWhite),
					leftReserveBlack: convertReserveToSparePieces(argOtherReserveBlack),
					rightReserveWhite: convertReserveToSparePieces(argReserveWhite),
					rightReserveBlack: convertReserveToSparePieces(argReserveBlack),
				};
			}

			await supabase.from('games').update(updatePayload).eq('id', data.id);
			gameSocket.in(socket.room).emit('update game', emitData);

			if (game.game_over()) {
				let termination;
				if (game.in_checkmate()) {
					termination = (data.userPosition === 1 || data.userPosition === 4)
						? 'Checkmate, Team 1 is victorious' : 'Checkmate, Team 2 is victorious';
				} else if (game.in_stalemate) {
					termination = 'Drawn by stalemate';
				} else if (game.in_threefold_repetition) {
					termination = 'Drawn by three-fold repetition';
				} else {
					termination = 'Drawn by the 50 move rule';
				}
				await Game.endGame(row, termination, socket, gameSocket, clearRoom);
			}
		} else {
			socket.emit('snapback move', { fen: game.fen() });
		}
	} catch (err) {
		socket.emit('snapback move', { fen: null });
	} finally {
		releaseLock();
	}
};
