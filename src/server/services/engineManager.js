const StockfishEngine = require('./stockfishEngine');
const Game = require('../models/Game');
const Bug = require('./bug');
const bughouseEval = require('./bughouseEval');
const logger = require('../logger');

// In-memory store: gameId -> { enginePlayers, engineSkillLevels, engines, drawnBoards }
const gameStore = {};

const ROLE_MAP = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };

function getPieceFromFen(fen, square) {
	const ranks = fen.split(' ')[0].split('/');
	const file = square.charCodeAt(0) - 97;
	const rank = 8 - parseInt(square[1]);
	let col = 0;
	for (const char of ranks[rank]) {
		if (!isNaN(char)) {
			col += parseInt(char);
		} else {
			if (col === file) {
				const pieceMap = {
					p: { color: 'black', role: 'pawn' },
					n: { color: 'black', role: 'knight' },
					b: { color: 'black', role: 'bishop' },
					r: { color: 'black', role: 'rook' },
					q: { color: 'black', role: 'queen' },
					k: { color: 'black', role: 'king' },
					P: { color: 'white', role: 'pawn' },
					N: { color: 'white', role: 'knight' },
					B: { color: 'white', role: 'bishop' },
					R: { color: 'white', role: 'rook' },
					Q: { color: 'white', role: 'queen' },
					K: { color: 'white', role: 'king' },
				};
				return pieceMap[char];
			}
			col++;
		}
	}
	return null;
}

/**
 * Find immediate checkmate drop using pruned candidates.
 * Checks king-zone drops first (most likely to mate), then falls back to all squares.
 */
function findCheckmateDrop(fen, availablePieces, reserveWhite, reserveBlack) {
	if (!availablePieces || availablePieces.length === 0) return null;
	const sideToMove = fen.split(' ')[1];
	const uniqueTypes = [...new Set(availablePieces.map(p => p.type))];
	const bug = new Bug(fen);
	bug.setReserves(reserveWhite.slice(), reserveBlack.slice());

	// First pass: only check king-zone and check-giving squares (fast)
	for (const type of uniqueTypes) {
		const candidates = bughouseEval.getCandidateDropSquares(bug, type, sideToMove, 16);
		for (const candidate of candidates) {
			try {
				const g = new Bug(fen);
				g.setReserves(reserveWhite.slice(), reserveBlack.slice());
				const result = g.move(`${type.toUpperCase()}@${candidate.square}`);
				if (result && g.in_checkmate()) {
					return { type, square: candidate.square };
				}
			} catch (e) { /* skip illegal */ }
		}
	}

	// Second pass: check ALL squares (handles edge cases the heuristic might miss)
	for (const type of uniqueTypes) {
		for (let f = 0; f < 8; f++) {
			for (let r = 1; r <= 8; r++) {
				const square = String.fromCharCode(97 + f) + r;
				try {
					const g = new Bug(fen);
					g.setReserves(reserveWhite.slice(), reserveBlack.slice());
					const result = g.move(`${type.toUpperCase()}@${square}`);
					if (result && g.in_checkmate()) {
						return { type, square };
					}
				} catch (e) { /* skip illegal */ }
			}
		}
	}
	return null;
}

/**
 * Generate pruned, scored drop candidates using bughouseEval.
 * Uses tactical pruning: king-zone, check squares, defensive squares.
 * Returns array of { drop: { type, square }, fen, heuristicScore } sorted best-first.
 */
function generatePrunedDropCandidates(fen, availablePieces, reserveWhite, reserveBlack) {
	if (!availablePieces || availablePieces.length === 0) return [];
	const sideToMove = fen.split(' ')[1];
	const uniqueTypes = [...new Set(availablePieces.map(p => p.type))];
	const bug = new Bug(fen);
	bug.setReserves(reserveWhite.slice(), reserveBlack.slice());
	const candidates = [];

	for (const type of uniqueTypes) {
		// Get pruned candidate squares (capped at 12 per type)
		const squares = bughouseEval.getCandidateDropSquares(bug, type, sideToMove, 12);
		for (const sq of squares) {
			try {
				const g = new Bug(fen);
				g.setReserves(reserveWhite.slice(), reserveBlack.slice());
				const result = g.move(`${type.toUpperCase()}@${sq.square}`);
				if (result) {
					candidates.push({
						drop: { type, square: sq.square },
						fen: g.fen(),
						heuristicScore: sq.score,
						givesCheck: g.in_check()
					});
				}
			} catch (e) { /* skip illegal */ }
		}
	}

	// Sort by move ordering priority:
	// 1. Drop checks (highest)
	// 2. High heuristic score (king-zone, forks, etc.)
	candidates.sort((a, b) => {
		if (a.givesCheck && !b.givesCheck) return -1;
		if (!a.givesCheck && b.givesCheck) return 1;
		return b.heuristicScore - a.heuristicScore;
	});

	return candidates;
}

/**
 * Determine team mapping for a given player position.
 * Team 1: Player 1 (left white) + Player 4 (right black)
 * Team 2: Player 2 (left black) + Player 3 (right white)
 */
function getTeamInfo(userPosition) {
	if (userPosition === 1) {
		return { board: 1, color: 'w', teammateBoardNum: 2, teammateColor: 'b', teammatePosition: 4 };
	} else if (userPosition === 2) {
		return { board: 1, color: 'b', teammateBoardNum: 2, teammateColor: 'w', teammatePosition: 3 };
	} else if (userPosition === 3) {
		return { board: 2, color: 'w', teammateBoardNum: 1, teammateColor: 'b', teammatePosition: 2 };
	} else {
		return { board: 2, color: 'b', teammateBoardNum: 1, teammateColor: 'w', teammatePosition: 1 };
	}
}

/**
 * Compute board move capture adjustment using partner coupling.
 * Checks if the move's capture gives our partner a piece they need.
 */
function computeCaptureBonus(uciMove, fen, partnerNeed, oppPartnerDanger) {
	if (!uciMove || uciMove === '(none)' || !partnerNeed) return 0;
	const target = uciMove.substring(2, 4);
	const source = uciMove.substring(0, 2);
	const capturedPiece = getPieceFromFen(fen, target);
	const movedPiece = getPieceFromFen(fen, source);
	if (!capturedPiece || !movedPiece) return 0;

	const capturedType = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[capturedPiece.role];
	const movedType = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }[movedPiece.role];
	if (!capturedType || capturedType === 'k') return 0;

	// Check if our piece is likely recaptured (simple: is the target square defended?)
	const g = new Bug(fen);
	const enemyColor = fen.split(' ')[1] === 'w' ? 'b' : 'w';
	const likelyRecaptured = g.isAttacked(target, enemyColor);

	return bughouseEval.teamCaptureAdjustment(capturedType, partnerNeed, movedType, oppPartnerDanger, likelyRecaptured);
}

module.exports = {
	registerGame(gameId, enginePlayers, engineSkillLevels) {
		gameStore[gameId] = {
			enginePlayers,
			engineSkillLevels: engineSkillLevels || { 1: 5, 2: 5, 3: 5, 4: 5 },
			engines: {},
			drawnBoards: { 1: false, 2: false }
		};
	},

	isEnginePlayer(gameId, userPosition) {
		const game = gameStore[gameId];
		if (!game) return false;
		return !!game.enginePlayers[userPosition];
	},

	hasEngines(gameId) {
		return !!gameStore[gameId];
	},

	setBoardDrawn(gameId, boardNum) {
		if (gameStore[gameId]) {
			gameStore[gameId].drawnBoards[boardNum] = true;
		}
	},

	isBoardDrawn(gameId, boardNum) {
		return gameStore[gameId] && gameStore[gameId].drawnBoards[boardNum];
	},

	async getEngine(gameId, boardNum) {
		const game = gameStore[gameId];
		if (!game) return null;
		if (!game.engines[boardNum] || !game.engines[boardNum].started) {
			if (game.engines[boardNum]) {
				try { game.engines[boardNum].quit(); } catch (e) { /* ignore */ }
			}
			const boardPlayers = boardNum === 1 ? [1, 2] : [3, 4];
			const enginePlayer = boardPlayers.find(p => game.enginePlayers[p]);
			const skillLevel = enginePlayer ? (game.engineSkillLevels[enginePlayer] || 5) : 5;
			game.engines[boardNum] = new StockfishEngine(skillLevel);
			await game.engines[boardNum].start();
		}
		return game.engines[boardNum];
	},

	cleanupGame(gameId) {
		const game = gameStore[gameId];
		if (game) {
			Object.values(game.engines).forEach(engine => engine.quit());
			delete gameStore[gameId];
		}
	},

	async triggerEngineMoves(gameId, socket, gameSocket, clearRoom, updateGame, playerTokens) {
		const game = gameStore[gameId];
		if (!game) return;

		try {
			const row = await Game.getByID(gameId);
			if (row.status !== 'playing') return;

			const lrw = row.left_reserve_white  ? JSON.parse(row.left_reserve_white)  : [];
			const lrb = row.left_reserve_black  ? JSON.parse(row.left_reserve_black)  : [];

			// Check left board (players 1 and 2)
			if (!game.drawnBoards[1]) {
				const leftTurn = row.left_color_to_play;
				const leftPlayer = leftTurn === 'white' ? 1 : 2;
				if (game.enginePlayers[leftPlayer]) {
					const fen = row.left_fens.split(',').pop();
					const availablePieces = leftTurn === 'white' ? lrw : lrb;
					const engine = await this.getEngine(gameId, 1);

					// Fetch partner board state for coupling
					const rrw = row.right_reserve_white ? JSON.parse(row.right_reserve_white) : [];
					const rrb = row.right_reserve_black ? JSON.parse(row.right_reserve_black) : [];
					const rightFen = row.right_fens.split(',').pop();

					const moveData = await this._getBestMoveData(
						fen, availablePieces, lrw, lrb, engine, gameId, leftPlayer, playerTokens,
						{ otherBoardFen: rightFen, otherReserveWhite: rrw, otherReserveBlack: rrb }
					);
					if (moveData) {
						await updateGame(moveData, socket, gameSocket, clearRoom);
						await new Promise(resolve => setTimeout(resolve, 200));
						return this.triggerEngineMoves(gameId, socket, gameSocket, clearRoom, updateGame, playerTokens);
					}
				}
			}

			// Check right board (players 3 and 4) — re-fetch to pick up reserve changes
			if (!game.drawnBoards[2]) {
				const row2 = await Game.getByID(gameId);
				if (row2.status !== 'playing') return;
				const rightTurn = row2.right_color_to_play;
				const rightPlayer = rightTurn === 'white' ? 3 : 4;
				if (game.enginePlayers[rightPlayer]) {
					const fen = row2.right_fens.split(',').pop();
					const rrw = row2.right_reserve_white ? JSON.parse(row2.right_reserve_white) : [];
					const rrb = row2.right_reserve_black ? JSON.parse(row2.right_reserve_black) : [];
					const availablePieces = rightTurn === 'white' ? rrw : rrb;
					const engine = await this.getEngine(gameId, 2);

					// Fetch partner board state for coupling
					const lrw2 = row2.left_reserve_white ? JSON.parse(row2.left_reserve_white) : [];
					const lrb2 = row2.left_reserve_black ? JSON.parse(row2.left_reserve_black) : [];
					const leftFen = row2.left_fens.split(',').pop();

					const moveData = await this._getBestMoveData(
						fen, availablePieces, rrw, rrb, engine, gameId, rightPlayer, playerTokens,
						{ otherBoardFen: leftFen, otherReserveWhite: lrw2, otherReserveBlack: lrb2 }
					);
					if (moveData) {
						await updateGame(moveData, socket, gameSocket, clearRoom);
						await new Promise(resolve => setTimeout(resolve, 200));
						return this.triggerEngineMoves(gameId, socket, gameSocket, clearRoom, updateGame, playerTokens);
					}
				}
			}
		} catch (err) {
			logger.error(`Engine move error for game ${gameId}: ${err}`);
		}
	},

	/**
	 * Selects the best move with bughouse-aware evaluation.
	 *
	 * Strategy:
	 *   1. Immediate checkmate via drop → play immediately
	 *   1.5. 10% random forcing: play best-scored drop to ensure pieces get used
	 *   2. Compute partner coupling signals (PartnerNeed + OpponentPartnerDanger)
	 *   3. Get Stockfish's best board move (250ms search)
	 *   4. Generate PRUNED drop candidates (king-zone, checks, defensive)
	 *   5. Evaluate candidates with Stockfish + bughouse eval adjustments
	 *   6. Apply team capture bonus to board move score
	 *   7. Select best overall move
	 */
	async _getBestMoveData(fen, availablePieces, reserveWhite, reserveBlack, engine, gameId, userPosition, playerTokens, partnerBoardInfo) {
		const teamInfo = getTeamInfo(userPosition);

		// 1. Immediate checkmate via drop
		if (availablePieces && availablePieces.length > 0) {
			const mateDrop = findCheckmateDrop(fen, availablePieces, reserveWhite, reserveBlack);
			if (mateDrop) {
				return this._buildDropMoveData(mateDrop, fen, gameId, userPosition, playerTokens);
			}
		}

		// 1.5. 10% random drop forcing: bypass evaluation and play the top scored drop
		if (availablePieces && availablePieces.length > 0 && Math.random() < 0.10) {
			const forcedCandidates = generatePrunedDropCandidates(fen, availablePieces, reserveWhite, reserveBlack);
			if (forcedCandidates.length > 0) {
				return this._buildDropMoveData(forcedCandidates[0].drop, fen, gameId, userPosition, playerTokens);
			}
		}

		// 2. Compute partner coupling signals
		let partnerNeed = null;
		let oppPartnerDanger = null;
		if (partnerBoardInfo && partnerBoardInfo.otherBoardFen) {
			try {
				const teammateReserve = teamInfo.teammateColor === 'w'
					? partnerBoardInfo.otherReserveWhite
					: partnerBoardInfo.otherReserveBlack;
				partnerNeed = bughouseEval.computePartnerNeed(
					partnerBoardInfo.otherBoardFen, teammateReserve, teamInfo.teammateColor
				);

				// Opponent's partner color on the other board
				const oppPartnerColor = teamInfo.teammateColor === 'w' ? 'b' : 'w';
				oppPartnerDanger = bughouseEval.computeOpponentPartnerDanger(
					partnerBoardInfo.otherBoardFen, oppPartnerColor
				);
			} catch (e) {
				logger.error(`Partner coupling error: ${e}`);
			}
		}

		// 3. Stockfish board move
		const uciMove = await engine.getBestMove(fen, 250);
		const normalFen = uciMove && uciMove !== '(none)' ? this._applyUciMove(fen, uciMove) : null;

		// If no reserve pieces, just play the board move
		if (!availablePieces || availablePieces.length === 0) {
			return this._buildMoveData(uciMove, fen, gameId, userPosition, playerTokens);
		}

		// 4. Generate PRUNED drop candidates (king-zone, checks, defensive, tactical)
		const topDrops = generatePrunedDropCandidates(fen, availablePieces, reserveWhite, reserveBlack);

		// Cap at top 3 per piece type, max 10 total
		const perTypeLimit = 3;
		const typeCount = {};
		const filteredDrops = [];
		for (const candidate of topDrops) {
			const t = candidate.drop.type;
			typeCount[t] = (typeCount[t] || 0) + 1;
			if (typeCount[t] <= perTypeLimit) {
				filteredDrops.push(candidate);
			}
			if (filteredDrops.length >= 10) break;
		}

		// If no legal drops exist, play the board move
		if (filteredDrops.length === 0) {
			return this._buildMoveData(uciMove, fen, gameId, userPosition, playerTokens);
		}

		// 5. Evaluate board move + top drops SEQUENTIALLY
		let bestScore = Infinity;
		let bestDrop = null;

		if (normalFen) {
			let boardScore = await engine.evaluatePosition(normalFen, 100);
			if (boardScore !== null) {
				// 6. Apply team capture bonus to board move
				const captureBonus = computeCaptureBonus(uciMove, fen, partnerNeed, oppPartnerDanger);
				// Subtract bonus from score (lower score = better for us)
				boardScore -= captureBonus;
				bestScore = boardScore;
			}
		}

		for (const candidate of filteredDrops) {
			const score = await engine.evaluatePosition(candidate.fen, 100);
			if (score !== null) {
				// Apply bughouse eval adjustment: drops that give check or
				// target king-zone get an additional bonus
				let adjustedScore = score;
				if (candidate.givesCheck) adjustedScore -= 80;
				adjustedScore -= candidate.heuristicScore * 0.5; // weight heuristic so drops compete fairly

				if (adjustedScore < bestScore) {
					bestScore = adjustedScore;
					bestDrop = candidate.drop;
				}
			}
		}

		// 7. Play drop if it beats board move, otherwise play board move
		if (bestDrop) {
			return this._buildDropMoveData(bestDrop, fen, gameId, userPosition, playerTokens);
		}
		return this._buildMoveData(uciMove, fen, gameId, userPosition, playerTokens);
	},

	_applyDrop(fen, drop, reserveWhite, reserveBlack) {
		try {
			const g = new Bug(fen);
			g.setReserves(reserveWhite.slice(), reserveBlack.slice());
			const result = g.move(`${drop.type.toUpperCase()}@${drop.square}`);
			return result ? g.fen() : null;
		} catch (e) {
			return null;
		}
	},

	_applyUciMove(fen, uciMove) {
		if (!uciMove || uciMove === '(none)') return null;
		try {
			const g = new Bug(fen);
			const result = g.move({
				from: uciMove.substring(0, 2),
				to:   uciMove.substring(2, 4),
				promotion: uciMove.length > 4 ? uciMove[4] : undefined
			});
			return result ? g.fen() : null;
		} catch (e) {
			return null;
		}
	},

	_buildDropMoveData(drop, fen, gameId, userPosition, playerTokens) {
		const turnColor = fen.split(' ')[1] === 'w' ? 'white' : 'black';
		const tokenKey = `player${userPosition}Token`;
		return {
			id: gameId,
			userPosition,
			move: {
				source: 'spare',
				target: drop.square,
				piece: { color: turnColor, role: ROLE_MAP[drop.type] },
				promotion: null
			},
			token: playerTokens[tokenKey]
		};
	},

	_buildMoveData(uciMove, fen, gameId, userPosition, playerTokens) {
		if (!uciMove || uciMove === '(none)') return null;
		const source = uciMove.substring(0, 2);
		const target = uciMove.substring(2, 4);
		const promotion = uciMove.length > 4 ? uciMove[4] : null;
		const piece = getPieceFromFen(fen, source);
		if (!piece) return null;
		const tokenKey = `player${userPosition}Token`;
		return {
			id: gameId,
			userPosition,
			move: { source, target, piece, promotion },
			token: playerTokens[tokenKey]
		};
	}
};
