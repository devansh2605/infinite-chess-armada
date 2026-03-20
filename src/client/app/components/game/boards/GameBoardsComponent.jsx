import React from 'react';
import axios from 'axios';
import _ from 'lodash';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
import { Chessground } from 'chessground';
import { browserHistory } from 'react-router';
import UserLinkComponent from '../../common/UserLinkComponent';
import ReserveContainer from '../../../containers/game/boards/ReserveContainer';
import { socketGame } from '../../../socket';
import Clock from '../../../util/Clock';
import playSound from '../../../util/sound';
import './css/gameBoards.css';

export default class GameBoardsComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			drawOffer: null, // { boardNum, offeredBy }
			board1Drawn: false,
			board2Drawn: false,
			resignConfirm: null, // userPosition that is confirming resign
			gameOver: false,
			viewOffset: 0 // 0 = live position; N = N half-moves back
		};
		// Track last applied server update version to ignore stale socket messages
		this.lastAppliedVersion = 0;
		this.getDurationFormat = this.getDurationFormat.bind(this);
		this.selectPromotionPiece = this.selectPromotionPiece.bind(this);
		this.handleMove = this.handleMove.bind(this);
		this.onDropFromBoard = this.onDropFromBoard.bind(this);
		this.onDropFromReserve = this.onDropFromReserve.bind(this);
		this.updateGame = this.updateGame.bind(this);
		this.parseAndUpdateMoves = this.parseAndUpdateMoves.bind(this);
		this.snapbackMove = this.snapbackMove.bind(this);
		this.handleGameOver = this.handleGameOver.bind(this);
		this.handleLocalResign = this.handleLocalResign.bind(this);
		this.handleLocalDrawOffer = this.handleLocalDrawOffer.bind(this);
		this.handleLocalDrawAccept = this.handleLocalDrawAccept.bind(this);
		this.handleLocalDrawDecline = this.handleLocalDrawDecline.bind(this);
		this.goBack = this.goBack.bind(this);
		this.goForward = this.goForward.bind(this);
		this.returnToHome = this.returnToHome.bind(this);
		this._onNavigateToMove = this._onNavigateToMove.bind(this);
		this.board1 = null;
		this.board2 = null;
		this.tmpPromotionPiece = null;
		this.tmpSourceSquare = null;
		this.tmpTargetSquare = null;
		this.tmpBoardId = null;
		this.lastMoveBoardId = 1;
		this.squaresToHighlight = [];
		this.timer1 = null;
		this.timer2 = null;
		this.timer3 = null;
		this.timer4 = null;
		// FEN history for move navigation (populated on hydration)
		this.leftFens = [];
		this.rightFens = [];
		socketGame.on('update game', this.updateGame);
		socketGame.on('snapback move', this.snapbackMove);
		socketGame.on('game over', data => {
			playSound('notify');
			this.handleGameOver(data.termination);
		});
		socketGame.on('board drawn', data => {
			if (data.boardNum === 1) {
				this.setState({ board1Drawn: true, drawOffer: null });
				if (this.board1) this.board1.stop();
				if (this.timer1) this.timer1.running = false;
				if (this.timer2) this.timer2.running = false;
			} else {
				this.setState({ board2Drawn: true, drawOffer: null });
				if (this.board2) this.board2.stop();
				if (this.timer3) this.timer3.running = false;
				if (this.timer4) this.timer4.running = false;
			}
		});
		socketGame.on('local draw offered', data => {
			this.setState({ drawOffer: data });
		});
		socketGame.on('local draw declined', () => {
			this.setState({ drawOffer: null });
		});
	}

	componentDidMount() {
		window.addEventListener('navigateToMove', this._onNavigateToMove);
		socketGame.emit('room', { gameId: this.props.game.id, token: localStorage.getItem('token') });

		// Register tokens for engine moves
		if (this.props.localMode && this.props.playerTokens) {
			socketGame.emit('register tokens', {
				gameId: this.props.game.id,
				playerTokens: this.props.playerTokens
			});
		}

		// Clocks
		const minutesInMilliseconds = this.props.game.minutes * 60 * 1000;
		const incrementInMilliseconds = this.props.game.increment * 1000;

		if (this.props.localMode) {
			const tokens = this.props.playerTokens;
			this.timer1 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id, () => tokens.player1Token);
			this.timer2 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id, () => tokens.player2Token);
			this.timer3 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id, () => tokens.player3Token);
			this.timer4 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id, () => tokens.player4Token);
		} else {
			this.timer1 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id);
			this.timer2 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id);
			this.timer3 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id);
			this.timer4 = new Clock(minutesInMilliseconds, incrementInMilliseconds, socketGame, this.props.game.id);
		}

		function format(display) {
			return (minutes, seconds, deciseconds) => {
				const minutesDisplay = minutes < 10 ? `0${minutes}` : minutes;
				const secondsDisplay = seconds < 10 ? `0${seconds}` : seconds;
				if (minutes === 0 && seconds === 0 && deciseconds === 0) {
					display.style.backgroundColor = '#a00000';
				}
				if (minutes < 1 && seconds < 10) {
					display.style.width = '168px';
					display.innerHTML = `${minutesDisplay}:${secondsDisplay}.${deciseconds}`;
				} else {
					display.innerHTML = `${minutesDisplay}:${secondsDisplay}`;
				}
			};
		}
		if (this.props.userPosition === 1) {
			this.timer1.onTick(format(document.getElementById('left-game-bottom-clock')));
			this.timer2.onTick(format(document.getElementById('left-game-top-clock')));
			this.timer3.onTick(format(document.getElementById('right-game-top-clock')));
			this.timer4.onTick(format(document.getElementById('right-game-bottom-clock')));
		} else if (this.props.userPosition === 2) {
			this.timer1.onTick(format(document.getElementById('left-game-top-clock')));
			this.timer2.onTick(format(document.getElementById('left-game-bottom-clock')));
			this.timer3.onTick(format(document.getElementById('right-game-bottom-clock')));
			this.timer4.onTick(format(document.getElementById('right-game-top-clock')));
		} else if (this.props.userPosition === 3) {
			this.timer1.onTick(format(document.getElementById('right-game-top-clock')));
			this.timer2.onTick(format(document.getElementById('right-game-bottom-clock')));
			this.timer3.onTick(format(document.getElementById('left-game-bottom-clock')));
			this.timer4.onTick(format(document.getElementById('left-game-top-clock')));
		} else {
			this.timer1.onTick(format(document.getElementById('right-game-bottom-clock')));
			this.timer2.onTick(format(document.getElementById('right-game-top-clock')));
			this.timer3.onTick(format(document.getElementById('left-game-top-clock')));
			this.timer4.onTick(format(document.getElementById('left-game-bottom-clock')));
		}

		// Hydrate state
		axios.get(`${BACKEND}/api/games/state/${this.props.game.id}`)
			.then(res => {
				const data = res.data;
				if (!data || typeof data !== 'object' || !data.leftFens) return; // guard against HTML/invalid response
				if (data.moves) this.parseAndUpdateMoves(data.moves);
				this.props.updateReserves(data.leftReserveWhite || [], data.leftReserveBlack || [], data.rightReserveWhite || [], data.rightReserveBlack || []);
				// Store FEN history for move navigation
				this.leftFens = data.leftFens;
				this.rightFens = data.rightFens;

				// Hydrate resign and draw action buttons (skip in local mode)
				if (!this.props.localMode) {
					const resignState = data.resignState.split(',').map(Number);
					const drawState = data.drawState.split(',').map(Number);
					if ((this.props.userPosition === 1 && resignState[3] === 1)
						|| (this.props.userPosition === 2 && resignState[2] === 1)
						|| (this.props.userPosition === 3 && resignState[1] === 1)
						|| (this.props.userPosition === 4 && resignState[0] === 1)) {
						this.props.updateDisplayResignChoice(true);
					}
					if ((drawState[0] === 1 || drawState[1] === 1 || drawState[2] === 1 || drawState[3] === 1) && drawState[this.props.userPosition - 1] !== 1) {
						this.props.updateDisplayDrawChoice(true);
					}
				}

				// Game boards
				const leftConfig = {
					fen: data.leftFens[data.leftFens.length - 1],
					lastMove: data.leftLastMove,
					turnColor: data.leftColorToPlay
				};
				const rightConfig = {
					fen: data.rightFens[data.rightFens.length - 1],
					lastMove: data.rightLastMove,
					turnColor: data.rightColorToPlay
				};

				if (this.props.localMode) {
					// Local mode: both boards are interactive
					const leftPlayingConfig = {
						predroppable: { enabled: true },
						movable: { free: true, color: data.leftColorToPlay || 'white' },
						events: {
							move: (source, target) => this.onDropFromBoard(source, target, 1),
							dropNewPiece: (piece, target) => this.onDropFromReserve(piece, target, 1)
						},
						animation: { enabled: false },
						viewOnly: false
					};
					const rightPlayingConfig = {
						predroppable: { enabled: true },
						movable: { free: true, color: data.rightColorToPlay || 'white' },
						events: {
							move: (source, target) => this.onDropFromBoard(source, target, 2),
							dropNewPiece: (piece, target) => this.onDropFromReserve(piece, target, 2)
						},
						animation: { enabled: false },
						viewOnly: false
					};
					this.board1 = Chessground(document.getElementById('board1'), _.assign({}, leftConfig, leftPlayingConfig));
					this.board2 = Chessground(document.getElementById('board2'), _.assign({}, rightConfig, rightPlayingConfig));
					this.board2.toggleOrientation();
				} else {
					// Normal mode: only user's board is interactive
					const playingConfig = {
						predroppable: {
							enabled: true,
						},
						movable: {
							color: (this.props.userPosition === 1 || this.props.userPosition === 3) ? 'white' : 'black',
						},
						events: {
							move: this.onDropFromBoard,
							dropNewPiece: this.onDropFromReserve
						},
						animation: {
							enabled: false
						},
						viewOnly: false
					};
					const viewOnlyConfig = {
						viewOnly: true,
						disableContextMenu: true
					};
					const board1Config = playingConfig;
					if (this.props.userPosition === 1 || this.props.userPosition === 2) {
						this.board1 = Chessground(document.getElementById('board1'), _.assign({}, leftConfig, board1Config));
						this.board2 = Chessground(document.getElementById('board2'), _.assign({}, rightConfig, viewOnlyConfig));
					} else {
						this.board1 = Chessground(document.getElementById('board1'), _.assign({}, rightConfig, board1Config));
						this.board2 = Chessground(document.getElementById('board2'), _.assign({}, leftConfig, viewOnlyConfig));
					}
					if (this.props.userPosition === 1 || this.props.userPosition === 3) {
						this.board2.toggleOrientation();
					} else {
						this.board1.toggleOrientation();
					}
				}

				// Hydrate clocks
				const currentTime = Date.now();
				if (data.leftLastTime) {
					const diffTime = currentTime - data.leftLastTime;
					if (data.leftColorToPlay === 'white') {
						this.timer1.toggle(data.clocks[0] + diffTime);
						this.timer2.setDuration(minutesInMilliseconds - data.clocks[1]);
					} else {
						this.timer1.setDuration(minutesInMilliseconds - data.clocks[0]);
						this.timer2.toggle(data.clocks[1] + diffTime);
					}
				}
				if (data.rightLastTime) {
					const diffTime = currentTime - data.rightLastTime;
					if (data.rightColorToPlay === 'white') {
						this.timer3.toggle(data.clocks[2] + diffTime);
						this.timer4.setDuration(minutesInMilliseconds - data.clocks[3]);
					} else {
						this.timer3.setDuration(minutesInMilliseconds - data.clocks[2]);
						this.timer4.toggle(data.clocks[3] + diffTime);
					}
				}
				if (data.termination) {
					this.handleGameOver(data.termination);
				}
			}).catch(console.error);
	}

	componentWillReceiveProps(nextProps) {
		// When isPlaying becomes true (after the userIsPlayingOrObserving API call returns),
		// update board1 from view-only to interactive. This handles the race condition where
		// the board was initialized before the API response arrived.
		if (!this.props.isPlaying && nextProps.isPlaying && !nextProps.localMode && this.board1) {
			const movableColor = (nextProps.userPosition === 1 || nextProps.userPosition === 3) ? 'white' : 'black';
			this.board1.set({
				predroppable: { enabled: true },
				movable: { color: movableColor },
				events: { move: this.onDropFromBoard, dropNewPiece: this.onDropFromReserve },
				viewOnly: false
			});
		}

		if (!_.isEmpty(nextProps.pieceToDragFromReserve)) {
			const mouseEvent = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				view: window
			});
			if (this.props.localMode && nextProps.pieceToDragFromReserve.boardId === 2) {
				this.board2.dragNewPiece(nextProps.pieceToDragFromReserve, mouseEvent);
			} else {
				this.board1.dragNewPiece(nextProps.pieceToDragFromReserve, mouseEvent);
			}
			this.props.updatePieceToDragFromReserve({});
		}
	}

	componentWillUnmount() {
		window.removeEventListener('navigateToMove', this._onNavigateToMove);
	}

	getDurationFormat(duration) {
		let minutes = Math.floor(duration / 60);
		minutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
		let seconds = duration % 60;
		seconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
		return `${minutes}:${seconds}`;
	}

	getTargetColumn(letter) {
		if (letter === 'a') return 1;
		if (letter === 'b') return 2;
		if (letter === 'c') return 3;
		if (letter === 'd') return 4;
		if (letter === 'e') return 5;
		if (letter === 'f') return 6;
		if (letter === 'g') return 7;
		return 8;
	}

	selectPromotionPiece(piece) {
		if (!this.tmpTargetSquare) return; // no promotion pending
		const mapping = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q' };
		this.tmpPromotionPiece = mapping[piece.role];
		const boardId = this.tmpBoardId || 1;
		const board = boardId === 2 ? this.board2 : this.board1;
		board.newPiece(piece, this.tmpTargetSquare);
		document.getElementById('whitePromotion').style.display = 'none';
		document.getElementById('blackPromotion').style.display = 'none';
		const wp2 = document.getElementById('whitePromotion2');
		const bp2 = document.getElementById('blackPromotion2');
		if (wp2) wp2.style.display = 'none';
		if (bp2) bp2.style.display = 'none';
		this.handleMove(this.tmpSourceSquare, this.tmpTargetSquare, piece, boardId);
	}

	handleMove(source, target, piece, boardId) {
		boardId = boardId || 1;
		const board = boardId === 2 ? this.board2 : this.board1;
		if (source !== 'spare') {
			board.move(source, target);
		}
		let userPosition = this.props.userPosition;
		let token = localStorage.getItem('token');
		if (this.props.localMode) {
			if (boardId === 1) {
				userPosition = piece.color === 'white' ? 1 : 2;
			} else {
				userPosition = piece.color === 'white' ? 3 : 4;
			}
			const tokenMap = {
				1: this.props.playerTokens.player1Token,
				2: this.props.playerTokens.player2Token,
				3: this.props.playerTokens.player3Token,
				4: this.props.playerTokens.player4Token
			};
			token = tokenMap[userPosition];
		}
		const data = {
			id: this.props.game.id,
			userPosition,
			move: {
				source,
				target,
				piece,
				promotion: this.tmpPromotionPiece
			},
			token
		};
		socketGame.emit('update game', data);
		this.tmpPromotionPiece = null;
		this.lastMoveBoardId = boardId;
	}

	onDropFromBoard(source, target, boardId) {
		boardId = boardId || 1;
		const board = boardId === 2 ? this.board2 : this.board1;
		const piece = board.state.pieces[target];
		// check if move is a pawn promotion, validate on server
		if (source !== 'spare' && piece.role === 'pawn' && (target.charAt(1) === '1' || target.charAt(1) === '8')) {
			let putUserPosition = this.props.userPosition;
			if (this.props.localMode) {
				if (boardId === 1) {
					putUserPosition = piece.color === 'white' ? 1 : 2;
				} else {
					putUserPosition = piece.color === 'white' ? 3 : 4;
				}
			}
			const putData = { source, target, piece, userPosition: putUserPosition };
			axios.put(`${BACKEND}/api/games/validate/pawnpromotion/${this.props.game.id}`, putData)
				.then(response => {
					const data = response.data;
					if (data.valid) {  // promotion is allowed, display popup to select piece
						const letter = target.charAt(0);
						let targetColumn = this.getTargetColumn(letter);
						// For flipped board2 in local mode, reverse column position
						const isFlipped = this.props.localMode && boardId === 2;
						if (isFlipped) targetColumn = 9 - targetColumn;
						const promoWhiteId = boardId === 2 ? 'whitePromotion2' : 'whitePromotion';
						const promoBlackId = boardId === 2 ? 'blackPromotion2' : 'blackPromotion';
						if (piece.color.charAt(0) === 'w') {
							document.getElementById(promoWhiteId).style.display = 'block';
							document.getElementById(promoWhiteId).style.transform = `translate(${(targetColumn * 62.5) - 62.5}px)`;
						} else {
							targetColumn = 9 - targetColumn;
							document.getElementById(promoBlackId).style.display = 'block';
							document.getElementById(promoBlackId).style.transform = `translate(${(targetColumn * 62.5) - 62.5}px)`;
						}
						this.tmpSourceSquare = source;
						this.tmpTargetSquare = target;
						this.tmpBoardId = boardId;
						delete board.state.pieces[this.tmpSourceSquare];
					}
					board.set({ fen: data.fen });
				})
				.catch(console.error('Error validating pawn promotion'));
		} else { // not a promotion, handle move normally
			this.handleMove(source, target, piece, boardId);
		}
	}

	onDropFromReserve(piece, target, boardId) {
		this.handleMove('spare', target, piece, boardId || 1);
	}

	updateGame(data) {
		if (!this.board1 || !this.board2) return; // boards not yet initialized

		// If server provided a version, ignore stale updates older than the
		// last applied version to avoid out-of-order swaps when multiple
		// actors (engines/humans) update the game concurrently.
		if (data.version && data.version <= this.lastAppliedVersion) return;
		if (data.version) this.lastAppliedVersion = data.version;

		// Track FEN history for move navigation
		if (data.boardNum === 1) this.leftFens.push(data.fens[data.fens.length - 1]);
		else this.rightFens.push(data.fens[data.fens.length - 1]);

		this.squaresToHighlight = data.move.source !== 'spare' ? [data.move.source, data.move.target] : [data.move.target];
		const isViewing = this.state.viewOffset > 0;

		if (!isViewing) {
			const boardStateWithTurnColor = {
				fen: data.fens[data.fens.length - 1],
				lastMove: this.squaresToHighlight,
				turnColor: data.turn
			};
			const boardStateWithoutTurnColor = {
				fen: data.fens[data.fens.length - 1],
				lastMove: this.squaresToHighlight
			};
			function handleSound() {
				if (data.capture) {
					playSound('capture');
				} else {
					playSound('move');
				}
			}
			if (this.props.localMode) {
				if (data.boardNum === 1) {
					this.board1.set(_.assign({}, boardStateWithTurnColor, { movable: { free: true, color: data.turn } }));
					this.updateTimers1And2(data.clocks, data.turn);
					handleSound();
				} else {
					this.board2.set(_.assign({}, boardStateWithTurnColor, { movable: { free: true, color: data.turn } }));
					this.updateTimers3And4(data.clocks, data.turn);
					handleSound();
				}
			} else if (this.props.userPosition === 1 || this.props.userPosition === 2) {
				if (data.boardNum === 1) {
					this.board1.set(boardStateWithTurnColor);
					this.updateTimers1And2(data.clocks, data.turn);
					handleSound();
				} else {
					this.board2.set(boardStateWithoutTurnColor);
					this.updateTimers3And4(data.clocks, data.turn);
				}
			} else {
				if (data.boardNum === 1) {
					this.board2.set(boardStateWithoutTurnColor);
					this.updateTimers1And2(data.clocks, data.turn);
				} else {
					this.board1.set(boardStateWithTurnColor);
					this.updateTimers3And4(data.clocks, data.turn);
					handleSound();
				}
			}
			this.board1.playPremove();
			this.board1.cancelPredrop();
			if (this.props.localMode) {
				this.board2.playPremove();
				this.board2.cancelPredrop();
			}
		} else {
			// Viewing history: still update timers, skip board visual updates
			if (data.boardNum === 1) this.updateTimers1And2(data.clocks, data.turn);
			else this.updateTimers3And4(data.clocks, data.turn);
		}

		this.props.updateReserves(data.leftReserveWhite, data.leftReserveBlack, data.rightReserveWhite, data.rightReserveBlack);
		this.props.updateClocks(data.clocks);
		this.parseAndUpdateMoves(data.moves);
	}

	updateTimers1And2(clocks, turn) {
		if (!this.timer1.isRunning() && !this.timer2.isRunning() && turn === 'black') { // Start clocks at end of white's first move
			this.timer2.toggle(clocks[0]);
		} else if (!this.timer1.isRunning() && !this.timer2.isRunning() && turn === 'white') {
			// do nothing
		} else { // Not end of first full move, toggle both clocks
			this.timer1.toggle(clocks[0]);
			this.timer2.toggle(clocks[1]);
		}
	}

	updateTimers3And4(clocks, turn) {
		if (!this.timer3.isRunning() && !this.timer4.isRunning() && turn === 'black') { // Start clocks at end of white's first move
			this.timer4.toggle(clocks[2]);
		} else if (!this.timer3.isRunning() && !this.timer4.isRunning() && turn === 'white') {
			// do nothing
		} else { // Not first move, toggle both clocks
			this.timer3.toggle(clocks[2]);
			this.timer4.toggle(clocks[3]);
		}
	}

	parseAndUpdateMoves(moves) {
		if (!moves || !moves.trim()) return;
		const newMoves = this.props.moves.slice(); // shallow copy to avoid mutating Redux state
		const arrMoves = moves.trim().split(' ');
		for (let i = 0; i + 1 < arrMoves.length; i += 2) {
			const token = arrMoves[i];
			if (!token || token.length < 3) continue;
			const playerLetter = token.charAt(token.length - 2);
			const moveNumber = token.substring(0, token.length - 2);
			const moveIdx = parseInt(moveNumber, 10) - 1;
			if (isNaN(moveIdx) || moveIdx < 0) continue;
			const moveStr = arrMoves[i + 1];
			if (!newMoves[moveIdx]) newMoves[moveIdx] = {};
			newMoves[moveIdx].number = moveNumber;
			if (playerLetter === 'A') {
				newMoves[moveIdx].player1 = moveStr;
			} else if (playerLetter === 'a') {
				newMoves[moveIdx].player2 = moveStr;
			} else if (playerLetter === 'B') {
				newMoves[moveIdx].player3 = moveStr;
			} else {
				newMoves[moveIdx].player4 = moveStr;
			}
		}
		this.props.updateMoves(newMoves);
		const tbody = document.getElementById('movesTableTBody');
		if (tbody) tbody.scrollTop = tbody.scrollHeight;
	}

	snapbackMove(data) {
		if (!data.fen || !this.board1 || !this.board2) return;
		if (this.props.localMode) {
			const board = this.lastMoveBoardId === 2 ? this.board2 : this.board1;
			const oldTurnColor = board.state.turnColor === 'white' ? 'black' : 'white';
			board.set({ fen: data.fen, lastMove: this.squaresToHighlight, turnColor: oldTurnColor });
		} else {
			const oldTurnColor = this.board1.state.turnColor === 'white' ? 'black' : 'white';
			this.board1.set({ fen: data.fen, lastMove: this.squaresToHighlight, turnColor: oldTurnColor });
		}
	}

	handleGameOver(gameTermination) {
		if (this.board1) this.board1.stop();
		if (this.board2) this.board2.stop();
		if (this.timer1) this.timer1.running = false;
		if (this.timer2) this.timer2.running = false;
		if (this.timer3) this.timer3.running = false;
		if (this.timer4) this.timer4.running = false;
		this.props.updateGameTermination(gameTermination);
		this.setState({ gameOver: true });
	}

	handleLocalResign(userPosition) {
		if (this.state.resignConfirm === userPosition) {
			const tokenMap = {
				1: this.props.playerTokens.player1Token,
				2: this.props.playerTokens.player2Token,
				3: this.props.playerTokens.player3Token,
				4: this.props.playerTokens.player4Token
			};
			socketGame.emit('local resign', {
				id: this.props.game.id,
				userPosition,
				token: tokenMap[userPosition]
			});
			this.setState({ resignConfirm: null });
		} else {
			this.setState({ resignConfirm: userPosition });
			setTimeout(() => {
				this.setState(state => {
					if (state.resignConfirm === userPosition) return { resignConfirm: null };
					return null;
				});
			}, 3000);
		}
	}

	handleLocalDrawOffer(userPosition) {
		const boardNum = (userPosition === 1 || userPosition === 2) ? 1 : 2;
		socketGame.emit('local offer draw', {
			id: this.props.game.id,
			boardNum,
			userPosition
		});
	}

	handleLocalDrawAccept(boardNum) {
		socketGame.emit('local accept draw', {
			id: this.props.game.id,
			boardNum,
			token: this.props.playerTokens.player1Token
		});
	}

	handleLocalDrawDecline(boardNum) {
		socketGame.emit('local decline draw', {
			id: this.props.game.id,
			boardNum
		});
	}

	goBack() {
		const maxOffset = Math.max(
			this.leftFens.length > 0 ? this.leftFens.length - 1 : 0,
			this.rightFens.length > 0 ? this.rightFens.length - 1 : 0
		);
		if (maxOffset === 0) return;
		const newOffset = Math.min(this.state.viewOffset + 1, maxOffset);
		if (newOffset === this.state.viewOffset) return;
		this._applyViewOffset(newOffset);
		this.setState({ viewOffset: newOffset });
	}

	goForward() {
		if (this.state.viewOffset === 0) return;
		const newOffset = this.state.viewOffset - 1;
		if (newOffset === 0) {
			this._restoreLiveView();
		} else {
			this._applyViewOffset(newOffset);
		}
		this.setState({ viewOffset: newOffset });
	}

	returnToHome() {
		if (this.props.localMode) {
			if (this.timer1) this.timer1.running = false;
			if (this.timer2) this.timer2.running = false;
			if (this.timer3) this.timer3.running = false;
			if (this.timer4) this.timer4.running = false;
			const gameId = this.props.game.id;
			axios.post(`${BACKEND}/api/games/pause/${gameId}`)
				.catch(() => {})
				.then(() => {
					localStorage.setItem(`pausedGame_${gameId}`, JSON.stringify({
						playerTokens: this.props.playerTokens,
						enginePlayers: this.props.enginePlayers
					}));
					this.props.resetGameState();
					browserHistory.push('/');
				});
		} else {
			this.props.resetGameState();
			browserHistory.push('/');
		}
	}

	_onNavigateToMove(event) {
		const { boardNum, fenIdx } = event.detail;
		const targetFens = boardNum === 1 ? this.leftFens : this.rightFens;
		const offset = Math.max(0, targetFens.length - 1 - fenIdx);
		if (offset === 0) {
			this._restoreLiveView();
			this.setState({ viewOffset: 0 });
		} else {
			this._applyViewOffset(offset);
			this.setState({ viewOffset: offset });
		}
	}

	_applyViewOffset(offset) {
		const leftIdx = Math.max(0, this.leftFens.length - 1 - offset);
		const rightIdx = Math.max(0, this.rightFens.length - 1 - offset);
		const leftFen = this.leftFens[leftIdx] || null;
		const rightFen = this.rightFens[rightIdx] || null;
		if (this.props.localMode) {
			if (this.board1 && leftFen) this.board1.set({ fen: leftFen, viewOnly: true });
			if (this.board2 && rightFen) this.board2.set({ fen: rightFen, viewOnly: true });
		} else if (this.props.userPosition === 1 || this.props.userPosition === 2) {
			if (this.board1 && leftFen) this.board1.set({ fen: leftFen, viewOnly: true });
			if (this.board2 && rightFen) this.board2.set({ fen: rightFen, viewOnly: true });
		} else {
			// board1 shows right board, board2 shows left board
			if (this.board1 && rightFen) this.board1.set({ fen: rightFen, viewOnly: true });
			if (this.board2 && leftFen) this.board2.set({ fen: leftFen, viewOnly: true });
		}
	}

	_restoreLiveView() {
		const leftFen = this.leftFens[this.leftFens.length - 1] || null;
		const rightFen = this.rightFens[this.rightFens.length - 1] || null;
		if (!leftFen || !rightFen) return;
		if (this.props.localMode) {
			if (this.board1) this.board1.set({ fen: leftFen, viewOnly: false });
			if (this.board2) this.board2.set({ fen: rightFen, viewOnly: false });
		} else if (this.props.userPosition === 1 || this.props.userPosition === 2) {
			if (this.board1) this.board1.set({ fen: leftFen, viewOnly: !this.props.isPlaying });
			if (this.board2) this.board2.set({ fen: rightFen, viewOnly: true });
		} else {
			if (this.board1) this.board1.set({ fen: rightFen, viewOnly: !this.props.isPlaying });
			if (this.board2) this.board2.set({ fen: leftFen, viewOnly: true });
		}
	}

	renderPlayerActions(userPosition) {
		if (!this.props.localMode || this.props.gameTermination) return null;

		const boardNum = (userPosition === 1 || userPosition === 2) ? 1 : 2;
		const isBoardDrawn = boardNum === 1 ? this.state.board1Drawn : this.state.board2Drawn;

		if (isBoardDrawn) {
			return <span style={drawnLabelStyle}>Drawn</span>;
		}

		const { drawOffer, resignConfirm } = this.state;

		// If there's a draw offer on this board and this player is the opponent
		if (drawOffer && drawOffer.boardNum === boardNum && drawOffer.offeredBy !== userPosition) {
			const offerBoardPlayers = boardNum === 1 ? [1, 2] : [3, 4];
			if (offerBoardPlayers.includes(userPosition)) {
				return (
					<span style={drawResponseStyle}>
						<span style={acceptBtnStyle} onClick={() => this.handleLocalDrawAccept(boardNum)} title="Accept draw">&#10003;</span>
						<span style={declineBtnStyle} onClick={() => this.handleLocalDrawDecline(boardNum)} title="Decline draw">&#10007;</span>
					</span>
				);
			}
		}

		const isEngine = this.props.enginePlayers && this.props.enginePlayers[userPosition];
		if (isEngine) return null;

		const isConfirming = resignConfirm === userPosition;

		return (
			<span style={actionBtnsStyle}>
				<span
					style={isConfirming ? confirmResignBtnStyle : resignBtnStyle}
					onClick={() => this.handleLocalResign(userPosition)}
					title={isConfirming ? 'Click again to confirm' : 'Resign'}
				>
					{isConfirming ? 'Sure?' : '\u2691'}
				</span>
				<span
					style={drawBtnStyle}
					onClick={() => this.handleLocalDrawOffer(userPosition)}
					title="Offer draw"
				>
					&#189;
				</span>
			</span>
		);
	}

	render() {
		const localMode = this.props.localMode;
		const termination = this.props.gameTermination || (this.state.gameOver ? 'Game over' : null);
		const { viewOffset } = this.state;
		const isViewing = viewOffset > 0;
		return (
			<div style={{ position: 'relative' }}>
				{/* Navigation bar */}
				{!termination && (
					<div style={navBarStyle}>
						<button style={navBtnStyle} onClick={this.goBack} title="Previous move">&#8592;</button>
						<span style={isViewing ? navOffsetStyle : navLiveStyle}>
							{isViewing ? `-${viewOffset}` : '\u2022 Live'}
						</span>
						<button style={navBtnStyle} onClick={this.goForward} disabled={!isViewing} title="Next move">&#8594;</button>
						<button style={returnBtnStyle} onClick={this.returnToHome} title="Return to home">&#8617; Home</button>
					</div>
				)}
			<div className="boardsWrapper" style={{ position: 'relative' }}>
				{termination && (
					<div style={gameOverBannerStyle}>
						<span>{termination}</span>
						<button
							style={homeButtonStyle}
							onClick={() => {
								this.props.resetGameState();
								browserHistory.push('/');
							}}
						>
							Return to Home
						</button>
					</div>
				)}
				<div className="boardColumn">
					<h3>
						<UserLinkComponent user={this.props.display.player2} rating={this.props.display.player2.rating} />
					</h3>
					<div className="container-fluid align-reserve-clock-top">
						<ReserveContainer clickable={localMode} floatRight={false} margin="bottom" reservePosition={2} boardId={1} />
						<div id="left-game-top-clock">
							{this.getDurationFormat(this.props.game.minutes * 60)}
						</div>
						<div style={leftActionTopStyle}>{this.renderPlayerActions(2)}</div>
					</div>
					<div id="whitePromotion" className="promotion-box">
						<img src="/app/static/img/pieces/wQ.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'white', role: 'queen' })}
						/>
						<img src="/app/static/img/pieces/wN.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'white', role: 'knight' })}
						/>
						<img src="/app/static/img/pieces/wR.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'white', role: 'rook' })}
						/>
						<img src="/app/static/img/pieces/wB.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'white', role: 'bishop' })}
						/>
					</div>
					<div id="blackPromotion" className="promotion-box">
						<img src="/app/static/img/pieces/bQ.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'black', role: 'queen' })}
						/>
						<img src="/app/static/img/pieces/bN.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'black', role: 'knight' })}
						/>
						<img src="/app/static/img/pieces/bR.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'black', role: 'rook' })}
						/>
						<img src="/app/static/img/pieces/bB.svg"
							className="promotionPiece"
							onClick={() => this.selectPromotionPiece({ color: 'black', role: 'bishop' })}
						/>
					</div>
					{this.state.board1Drawn && <div style={boardOverlayStyle}>Board Drawn</div>}
					<div id="board1" className="boardContainer" />
					<div className="align-reserve-clock-bottom">
						<ReserveContainer clickable floatRight={false} margin="top" reservePosition={1} boardId={1} />
						<h3 id="left-game-bottom-clock">{this.getDurationFormat(this.props.game.minutes * 60)}</h3>
						<div style={leftActionBottomStyle}>{this.renderPlayerActions(1)}</div>
					</div>
					<h3 className="left-game-bottom-username">
						<UserLinkComponent user={this.props.display.player1} rating={this.props.display.player1.rating} />
					</h3>
				</div>
				<div className="boardColumn">
					<h3 className="right-game-top-username">
						<UserLinkComponent user={this.props.display.player3} rating={this.props.display.player3.rating} />
					</h3>
					<div className="container-fluid align-reserve-clock-top">
						<h3 id="right-game-top-clock">{this.getDurationFormat(this.props.game.minutes * 60)}</h3>
						<div style={rightActionTopStyle}>{this.renderPlayerActions(3)}</div>
						<ReserveContainer clickable={localMode} floatRight margin="bottom" reservePosition={3} boardId={2} />
					</div>
					{localMode && (
						<div>
							<div id="whitePromotion2" className="promotion-box">
								<img src="/app/static/img/pieces/wQ.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'white', role: 'queen' })}
								/>
								<img src="/app/static/img/pieces/wN.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'white', role: 'knight' })}
								/>
								<img src="/app/static/img/pieces/wR.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'white', role: 'rook' })}
								/>
								<img src="/app/static/img/pieces/wB.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'white', role: 'bishop' })}
								/>
							</div>
							<div id="blackPromotion2" className="promotion-box">
								<img src="/app/static/img/pieces/bQ.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'black', role: 'queen' })}
								/>
								<img src="/app/static/img/pieces/bN.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'black', role: 'knight' })}
								/>
								<img src="/app/static/img/pieces/bR.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'black', role: 'rook' })}
								/>
								<img src="/app/static/img/pieces/bB.svg"
									className="promotionPiece"
									onClick={() => this.selectPromotionPiece({ color: 'black', role: 'bishop' })}
								/>
							</div>
						</div>
					)}
					{this.state.board2Drawn && <div style={boardOverlayStyle}>Board Drawn</div>}
					<div id="board2" className="boardContainer" />
					<div className="align-reserve-clock-bottom">
						<ReserveContainer clickable={localMode} floatRight margin="top" reservePosition={4} boardId={2} />
						<h3 id="right-game-bottom-clock">{this.getDurationFormat(this.props.game.minutes * 60)}</h3>
						<div style={rightActionBottomStyle}>{this.renderPlayerActions(4)}</div>
					</div>
					<h3 className="right-game-bottom-username">
						<UserLinkComponent user={this.props.display.player4} rating={this.props.display.player4.rating} />
					</h3>
				</div>
			</div>
			</div>
		);
	}
}

const leftActionTopStyle = {
	float: 'right',
	marginRight: '8px',
	marginTop: '12px'
};

const leftActionBottomStyle = {
	float: 'right',
	marginRight: '8px',
	marginTop: '22px'
};

const rightActionTopStyle = {
	float: 'left',
	marginLeft: '8px',
	marginTop: '12px'
};

const rightActionBottomStyle = {
	float: 'left',
	marginLeft: '8px',
	marginTop: '22px'
};

const actionBtnsStyle = {
	display: 'inline-flex',
	gap: '4px',
	marginLeft: '4px'
};

const resignBtnStyle = {
	cursor: 'pointer',
	fontSize: '18px',
	color: '#c44',
	padding: '2px 6px',
	borderRadius: '3px',
	backgroundColor: '#333',
	userSelect: 'none'
};

const confirmResignBtnStyle = {
	cursor: 'pointer',
	fontSize: '12px',
	color: '#fff',
	padding: '2px 8px',
	borderRadius: '3px',
	backgroundColor: '#c44',
	userSelect: 'none'
};

const drawBtnStyle = {
	cursor: 'pointer',
	fontSize: '14px',
	color: '#aaa',
	padding: '2px 6px',
	borderRadius: '3px',
	backgroundColor: '#333',
	userSelect: 'none'
};

const drawResponseStyle = {
	display: 'inline-flex',
	gap: '4px',
	marginLeft: '4px'
};

const acceptBtnStyle = {
	cursor: 'pointer',
	fontSize: '16px',
	color: '#4c4',
	padding: '2px 8px',
	borderRadius: '3px',
	backgroundColor: '#333',
	userSelect: 'none'
};

const declineBtnStyle = {
	cursor: 'pointer',
	fontSize: '16px',
	color: '#c44',
	padding: '2px 8px',
	borderRadius: '3px',
	backgroundColor: '#333',
	userSelect: 'none'
};

const drawnLabelStyle = {
	fontSize: '12px',
	color: '#aaa',
	marginLeft: '8px',
	fontStyle: 'italic'
};

const boardOverlayStyle = {
	position: 'relative',
	zIndex: 10,
	textAlign: 'center',
	backgroundColor: 'rgba(0,0,0,0.7)',
	color: '#fff',
	padding: '4px',
	fontSize: '14px',
	fontWeight: 'bold'
};

const gameOverBannerStyle = {
	position: 'absolute',
	top: 0,
	left: 0,
	right: 0,
	zIndex: 100,
	backgroundColor: 'rgba(0,0,0,0.85)',
	color: '#fff',
	padding: '10px 16px',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	fontSize: '14px',
	fontWeight: 'bold'
};

const homeButtonStyle = {
	cursor: 'pointer',
	padding: '6px 14px',
	borderRadius: '4px',
	border: 'none',
	backgroundColor: '#d85000',
	color: '#fff',
	fontSize: '13px',
	fontWeight: 'bold',
	marginLeft: '16px'
};

const navBarStyle = {
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	padding: '6px 8px',
	backgroundColor: '#1a1a1a',
	borderBottom: '1px solid #3d3d3d'
};

const navBtnStyle = {
	cursor: 'pointer',
	padding: '3px 10px',
	borderRadius: '3px',
	border: '1px solid #3d3d3d',
	backgroundColor: '#262626',
	color: '#e2e8f0',
	fontSize: '16px',
	lineHeight: 1
};

const navOffsetStyle = {
	color: '#f97316',
	fontWeight: 'bold',
	fontSize: '13px',
	minWidth: '40px',
	textAlign: 'center'
};

const navLiveStyle = {
	color: '#4ade80',
	fontSize: '13px',
	minWidth: '40px',
	textAlign: 'center'
};

const returnBtnStyle = {
	cursor: 'pointer',
	padding: '3px 12px',
	borderRadius: '3px',
	border: '1px solid #3d3d3d',
	backgroundColor: '#262626',
	color: '#94a3b8',
	fontSize: '13px',
	marginLeft: 'auto'
};
