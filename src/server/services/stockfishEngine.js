const { spawn } = require('child_process');
const logger = require('../logger');

const STOCKFISH_PATH = process.env.STOCKFISH_PATH ||
	(process.platform === 'darwin' ? '/opt/homebrew/bin/stockfish' : '/usr/bin/stockfish');

class StockfishEngine {
	constructor(skillLevel = 10) {
		this.process = null;
		this.skillLevel = skillLevel;
		this.outputBuffer = '';
		this.started = false;
	}

	start() {
		return new Promise((resolve, reject) => {
			try {
				this.process = spawn(STOCKFISH_PATH);
			} catch (err) {
				logger.error(`Failed to spawn stockfish: ${err}`);
				return reject(err);
			}

			this.process.stdout.on('data', data => {
				this.outputBuffer += data.toString();
			});

			this.process.stderr.on('data', data => {
				logger.error(`Stockfish stderr: ${data.toString()}`);
			});

			this.process.on('error', err => {
				logger.error(`Stockfish process error: ${err}`);
				reject(err);
			});

			this._send('uci');
			this._waitFor('uciok', 5000).then(() => {
				this._send(`setoption name Skill Level value ${this.skillLevel}`);
				this._send('setoption name Threads value 1');
				this._send('isready');
				return this._waitFor('readyok', 5000);
			}).then(() => {
				this.started = true;
				resolve();
			}).catch(reject);
		});
	}

	_send(command) {
		if (this.process && this.process.stdin.writable) {
			this.process.stdin.write(command + '\n');
		}
	}

	_waitFor(token, timeoutMs = 5000) {
		return new Promise((resolve, reject) => {
			const startTime = Date.now();
			const check = () => {
				if (this.outputBuffer.includes(token)) {
					this.outputBuffer = '';
					resolve();
				} else if (Date.now() - startTime > timeoutMs) {
					reject(new Error(`Timeout waiting for ${token}`));
				} else {
					setTimeout(check, 10);
				}
			};
			check();
		});
	}

	getBestMove(fen, moveTimeMs = 500) {
		return new Promise((resolve, reject) => {
			if (!this.started) {
				return reject(new Error('Engine not started'));
			}
			this.outputBuffer = '';
			this._send(`position fen ${fen}`);
			this._send(`go movetime ${moveTimeMs}`);

			const startTime = Date.now();
			const check = () => {
				const lines = this.outputBuffer.split('\n');
				for (const line of lines) {
					if (line.startsWith('bestmove')) {
						const parts = line.trim().split(' ');
						resolve(parts[1]);
						return;
					}
				}
				if (Date.now() - startTime > moveTimeMs + 5000) {
					reject(new Error('Timeout waiting for bestmove'));
				} else {
					setTimeout(check, 20);
				}
			};
			check();
		});
	}

	// Returns centipawn score for the side to move (positive = good). Returns null on error.
	evaluatePosition(fen, moveTimeMs = 150) {
		return new Promise((resolve) => {
			if (!this.started) return resolve(null);
			this.outputBuffer = '';
			this._send(`position fen ${fen}`);
			this._send(`go movetime ${moveTimeMs}`);
			const startTime = Date.now();
			const check = () => {
				const lines = this.outputBuffer.split('\n');
				let score = null;
				for (const line of lines) {
					if (line.startsWith('info') && line.includes('score cp')) {
						const m = line.match(/score cp (-?\d+)/);
						if (m) score = parseInt(m[1], 10);
					} else if (line.startsWith('info') && line.includes('score mate')) {
						const m = line.match(/score mate (-?\d+)/);
						if (m) score = parseInt(m[1], 10) > 0 ? 100000 : -100000;
					}
					if (line.startsWith('bestmove')) {
						return resolve(score);
					}
				}
				if (Date.now() - startTime > moveTimeMs + 3000) return resolve(null);
				setTimeout(check, 20);
			};
			check();
		});
	}

	quit() {
		if (this.process) {
			this._send('quit');
			this.process.kill();
			this.process = null;
			this.started = false;
		}
	}
}

module.exports = StockfishEngine;
