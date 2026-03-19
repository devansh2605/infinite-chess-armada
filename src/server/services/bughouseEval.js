/* eslint-disable */
'use strict';

/**
 * Bughouse-specific position evaluation module.
 *
 * Provides: evalPosition, scoreDrop, computePartnerNeed,
 *           computeOpponentPartnerDanger, getCheckDropSquares,
 *           getKingZoneSquares, getDefensiveDropSquares
 *
 * All functions operate on a Bug instance + reserve arrays without
 * mutating the Bug instance (they use makeMove/undoMove pairs).
 */

const Bug = require('./bug');

// ───────────────────── Constants ─────────────────────

// Bughouse material values (lower than standard — pieces recirculate)
const PIECE_VALUE = { p: 80, n: 275, b: 275, r: 425, q: 800, k: 0 };

// Piece-square tables (from White's perspective, row 0 = rank 8)
// Flipped for Black at lookup time.
const PST = {
    p: [
        [  0,  0,  0,  0,  0,  0,  0,  0],
        [ 50, 50, 50, 50, 50, 50, 50, 50],
        [ 10, 10, 20, 30, 30, 20, 10, 10],
        [  5,  5, 10, 25, 25, 10,  5,  5],
        [  0,  0,  0, 20, 20,  0,  0,  0],
        [  5, -5,-10,  0,  0,-10, -5,  5],
        [  5, 10, 10,-20,-20, 10, 10,  5],
        [  0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
        [  0,  0,  0,  5,  5,  0,  0,  0],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [ -5,  0,  0,  0,  0,  0,  0, -5],
        [  5, 10, 10, 10, 10, 10, 10,  5],
        [  0,  0,  0,  0,  0,  0,  0,  0]
    ],
    q: [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [  0,  0,  5,  5,  5,  5,  0, -5],
        [ -5,  0,  5,  5,  5,  5,  0, -5],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    k: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [ 20, 20,  0,  0,  0,  0, 20, 20],
        [ 20, 30, 10,  0,  0, 10, 30, 20]
    ]
};

// King safety: bonus weights for drop threats near enemy king
const DROP_CHECK_BONUS = 150;
const DROP_KING_ZONE_BONUS = 40;
const DROP_DEFENSE_BONUS = 30;
const DROP_FORK_BONUS = 100;

// ───────────────────── Helpers ─────────────────────

const FILES = 'abcdefgh';
const RANKS = '12345678';
const DROPPABLE = ['p', 'n', 'b', 'r', 'q'];

function squareToCoords(sq) {
    return { file: sq.charCodeAt(0) - 97, rank: parseInt(sq[1]) - 1 };
}

function coordsToSquare(f, r) {
    if (f < 0 || f > 7 || r < 0 || r > 7) return null;
    return FILES[f] + RANKS[r];
}

function pstLookup(type, square, color) {
    var c = squareToCoords(square);
    // PST is from White's perspective (row 0 = rank 8)
    var row = color === 'w' ? (7 - c.rank) : c.rank;
    var table = PST[type];
    if (!table) return 0;
    return table[row][c.file];
}

function chebyshevDist(sq1, sq2) {
    var c1 = squareToCoords(sq1);
    var c2 = squareToCoords(sq2);
    return Math.max(Math.abs(c1.file - c2.file), Math.abs(c1.rank - c2.rank));
}

/**
 * Return the 8 surrounding squares of a given square (valid only).
 */
function kingRing(sq) {
    var c = squareToCoords(sq);
    var ring = [];
    for (var df = -1; df <= 1; df++) {
        for (var dr = -1; dr <= 1; dr++) {
            if (df === 0 && dr === 0) continue;
            var s = coordsToSquare(c.file + df, c.rank + dr);
            if (s) ring.push(s);
        }
    }
    return ring;
}

/**
 * Return the "extended king zone": ring-1 + ring-2 + knight-check squares.
 */
function kingZone(sq) {
    var c = squareToCoords(sq);
    var zone = {};
    // ring-1 and ring-2
    for (var df = -2; df <= 2; df++) {
        for (var dr = -2; dr <= 2; dr++) {
            if (df === 0 && dr === 0) continue;
            var s = coordsToSquare(c.file + df, c.rank + dr);
            if (s) zone[s] = true;
        }
    }
    // knight-check squares
    var knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (var i = 0; i < knightOffsets.length; i++) {
        var s = coordsToSquare(c.file + knightOffsets[i][0], c.rank + knightOffsets[i][1]);
        if (s) zone[s] = true;
    }
    return Object.keys(zone);
}

/**
 * Parse a FEN to extract board layout quickly.
 * Returns array of {square, piece:{type,color}} for occupied squares.
 */
function parseFenPieces(fen) {
    var parts = fen.split(' ');
    var rows = parts[0].split('/');
    var pieces = [];
    for (var r = 0; r < 8; r++) {
        var f = 0;
        for (var c = 0; c < rows[r].length; c++) {
            var ch = rows[r][c];
            if (ch >= '1' && ch <= '8') {
                f += parseInt(ch);
            } else {
                var color = ch === ch.toUpperCase() ? 'w' : 'b';
                var type = ch.toLowerCase();
                var sq = FILES[f] + RANKS[7 - r];
                pieces.push({ square: sq, piece: { type: type, color: color } });
                f++;
            }
        }
    }
    return pieces;
}

/**
 * Find king square for a given color from FEN.
 */
function findKing(fen, color) {
    var pieces = parseFenPieces(fen);
    for (var i = 0; i < pieces.length; i++) {
        if (pieces[i].piece.type === 'k' && pieces[i].piece.color === color) {
            return pieces[i].square;
        }
    }
    return null;
}

// ───────────────────── Evaluation Components ─────────────────────

/**
 * 4.1 BoardEval — material + piece-square + simple mobility.
 * Returns score from `sideToEval`'s perspective.
 */
function evalBoard(fen, sideToEval) {
    var pieces = parseFenPieces(fen);
    var score = 0;

    for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        var val = PIECE_VALUE[p.piece.type] + pstLookup(p.piece.type, p.square, p.piece.color);
        if (p.piece.color === sideToEval) {
            score += val;
        } else {
            score -= val;
        }
    }

    return score;
}

/**
 * 4.2 PocketPotential — potential energy of pocket pieces.
 * For each unique piece type in pocket, estimate the value of the best drop.
 */
function evalPocketPotential(bug, reserve, sideToEval) {
    if (!reserve || reserve.length === 0) return 0;
    var score = 0;
    var seen = {};
    var fen = bug.fen();
    var enemyColor = sideToEval === 'w' ? 'b' : 'w';
    var enemyKing = findKing(fen, enemyColor);

    for (var i = 0; i < reserve.length; i++) {
        var type = reserve[i].type;
        // Score each instance (not just unique types — having 2 knights is better than 1)
        var bestDropVal = 0;
        if (enemyKing) {
            var zone = kingZone(enemyKing);
            for (var j = 0; j < zone.length; j++) {
                var sq = zone[j];
                if (bug.get(sq) === null) {
                    var rank = sq.charAt(1);
                    if (type === 'p' && (rank === '1' || rank === '8')) continue;
                    var val = pstLookup(type, sq, sideToEval) + DROP_KING_ZONE_BONUS;
                    if (val > bestDropVal) bestDropVal = val;
                }
            }
        }
        score += bestDropVal * 0.5; // discount since it's potential, not realized
    }

    return score;
}

/**
 * 4.3 KingDropSafety — penalize positions with many empty squares around king.
 * Also considers what pieces the opponent has in pocket.
 */
function evalKingDropSafety(fen, opponentReserve, sideToEval) {
    var ourKing = findKing(fen, sideToEval);
    if (!ourKing) return 0;

    var ring = kingRing(ourKing);
    var emptyCount = 0;
    var pieces = parseFenPieces(fen);
    var occupied = {};
    for (var i = 0; i < pieces.length; i++) {
        occupied[pieces[i].square] = pieces[i].piece;
    }

    for (var i = 0; i < ring.length; i++) {
        if (!occupied[ring[i]]) emptyCount++;
    }

    var penalty = 0;

    // Base penalty for empty squares near king
    penalty += emptyCount * 8;

    // Extra penalty if opponent has dangerous pocket pieces
    if (opponentReserve && opponentReserve.length > 0) {
        var typeCounts = {};
        for (var i = 0; i < opponentReserve.length; i++) {
            var t = opponentReserve[i].type;
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        }
        // Knight drops near king are very dangerous
        if (typeCounts['n']) penalty += typeCounts['n'] * emptyCount * 12;
        // Queen drops near king are devastating
        if (typeCounts['q']) penalty += typeCounts['q'] * emptyCount * 20;
        // Pawn drops can create shelter-breaking threats
        if (typeCounts['p']) penalty += typeCounts['p'] * emptyCount * 5;
        // Rook drops on open files near king
        if (typeCounts['r']) penalty += typeCounts['r'] * emptyCount * 8;
        // Bishop drops on diagonals
        if (typeCounts['b']) penalty += typeCounts['b'] * emptyCount * 7;
    }

    return -penalty;
}

/**
 * 4.4 PartnerNeed — for each piece type, compute how valuable it would be
 * as a drop on the partner's board.
 *
 * @param {string} partnerFen - FEN of partner's board
 * @param {Array} partnerReserve - partner's current reserve (our side's color on partner board)
 * @param {string} partnerColor - our partner's color on their board
 * @returns {Object} {p: score, n: score, b: score, r: score, q: score}
 */
function computePartnerNeed(partnerFen, partnerReserve, partnerColor) {
    var need = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    if (!partnerFen) return need;

    var enemyColor = partnerColor === 'w' ? 'b' : 'w';
    var enemyKing = findKing(partnerFen, enemyColor);
    if (!enemyKing) return need;

    var zone = kingZone(enemyKing);
    var pieces = parseFenPieces(partnerFen);
    var occupied = {};
    for (var i = 0; i < pieces.length; i++) {
        occupied[pieces[i].square] = true;
    }

    // For each droppable piece type, temporarily evaluate the best drop
    for (var ti = 0; ti < DROPPABLE.length; ti++) {
        var type = DROPPABLE[ti];

        // Check if partner already has this piece type — if so, need is lower
        var alreadyHas = false;
        if (partnerReserve) {
            for (var ri = 0; ri < partnerReserve.length; ri++) {
                if (partnerReserve[ri].type === type) { alreadyHas = true; break; }
            }
        }

        var bestVal = 0;
        for (var j = 0; j < zone.length; j++) {
            var sq = zone[j];
            if (occupied[sq]) continue;
            var rank = sq.charAt(1);
            if (type === 'p' && (rank === '1' || rank === '8')) continue;

            var val = pstLookup(type, sq, partnerColor);
            // Big bonus for squares that could give check (approximate)
            var dist = chebyshevDist(sq, enemyKing);
            if (dist <= 1 && type !== 'p') val += 50; // adjacent to king
            if (type === 'n') {
                // Knight check squares
                var kc = squareToCoords(enemyKing);
                var sc = squareToCoords(sq);
                var df = Math.abs(kc.file - sc.file);
                var dr = Math.abs(kc.rank - sc.rank);
                if ((df === 2 && dr === 1) || (df === 1 && dr === 2)) {
                    val += DROP_CHECK_BONUS;
                }
            }
            if (val > bestVal) bestVal = val;
        }

        need[type] = alreadyHas ? bestVal * 0.5 : bestVal;
    }

    return need;
}

/**
 * Compute how dangerous each piece type would be if the opponent's partner
 * received it.
 *
 * @param {string} partnerFen - FEN of the OTHER board (where our partner plays)
 * @param {string} oppPartnerColor - the opponent's partner color on that board
 * @returns {Object} {p: danger, n: danger, ...}
 */
function computeOpponentPartnerDanger(partnerFen, oppPartnerColor) {
    // This is symmetric to PartnerNeed but from the opponent's perspective
    return computePartnerNeed(partnerFen, [], oppPartnerColor);
}

// ───────────────────── Drop Scoring & Pruning ─────────────────────

/**
 * Score a specific drop move for move ordering.
 * Higher = more promising.
 */
function scoreDrop(bug, pieceType, square, sideToMove) {
    var score = 0;
    var enemyColor = sideToMove === 'w' ? 'b' : 'w';
    var fen = bug.fen();
    var enemyKing = findKing(fen, enemyColor);
    var ourKing = findKing(fen, sideToMove);

    // Base: piece-square table value
    score += pstLookup(pieceType, square, sideToMove);

    if (enemyKing) {
        var dist = chebyshevDist(square, enemyKing);

        // Big bonus if drop gives check (test by making the move)
        try {
            var testBug = new Bug(fen);
            var reserves = bug.getReserves();
            testBug.setReserves(
                sideToMove === 'w' ? [{type: pieceType, color: 'w'}] : reserves.reserve_white,
                sideToMove === 'b' ? [{type: pieceType, color: 'b'}] : reserves.reserve_black
            );
            var result = testBug.move(pieceType.toUpperCase() + '@' + square);
            if (result) {
                if (testBug.in_checkmate()) {
                    score += 50000; // mate
                } else if (testBug.in_check()) {
                    score += DROP_CHECK_BONUS;
                    // Extra bonus if few legal replies
                    var replies = testBug.moves();
                    if (replies.length <= 3) score += 80;
                    if (replies.length <= 1) score += 120;
                }
            }
        } catch (e) { /* ignore */ }

        // Bonus for king-zone drops
        if (dist <= 2) score += DROP_KING_ZONE_BONUS;
        if (dist <= 1) score += DROP_KING_ZONE_BONUS;

        // Knight fork potential: attacks king + high-value piece
        if (pieceType === 'n') {
            var knightTargets = getKnightTargets(square);
            var attacksKing = false;
            var attacksHighValue = false;
            for (var i = 0; i < knightTargets.length; i++) {
                var tp = bug.get(knightTargets[i]);
                if (tp && tp.color === enemyColor) {
                    if (tp.type === 'k') attacksKing = true;
                    if (tp.type === 'q' || tp.type === 'r') attacksHighValue = true;
                }
            }
            if (attacksKing && attacksHighValue) score += DROP_FORK_BONUS;
        }
    }

    // Defensive bonus: if our king is under threat, drops that block or cover
    if (ourKing && bug.in_check()) {
        score += DROP_DEFENSE_BONUS;
    }

    return score;
}

/**
 * Get all squares a knight on `sq` would attack.
 */
function getKnightTargets(sq) {
    var c = squareToCoords(sq);
    var offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    var targets = [];
    for (var i = 0; i < offsets.length; i++) {
        var s = coordsToSquare(c.file + offsets[i][0], c.rank + offsets[i][1]);
        if (s) targets.push(s);
    }
    return targets;
}

/**
 * 5.2 Generate pruned drop candidate squares for a given piece type.
 * Returns array of algebraic squares, capped at `limit` best candidates.
 */
function getCandidateDropSquares(bug, pieceType, sideToMove, limit) {
    limit = limit || 12;
    var fen = bug.fen();
    var enemyColor = sideToMove === 'w' ? 'b' : 'w';
    var enemyKing = findKing(fen, enemyColor);
    var ourKing = findKing(fen, sideToMove);
    var candidates = {};

    // 1. Check-giving squares
    if (enemyKing) {
        var zone = kingZone(enemyKing);
        for (var i = 0; i < zone.length; i++) {
            if (bug.get(zone[i]) === null) {
                var rank = zone[i].charAt(1);
                if (pieceType === 'p' && (rank === '1' || rank === '8')) continue;
                candidates[zone[i]] = true;
            }
        }
    }

    // 2. Defensive drops (if our king is in check or threatened)
    if (ourKing) {
        var ourRing = kingRing(ourKing);
        for (var i = 0; i < ourRing.length; i++) {
            if (bug.get(ourRing[i]) === null) {
                var rank = ourRing[i].charAt(1);
                if (pieceType === 'p' && (rank === '1' || rank === '8')) continue;
                candidates[ourRing[i]] = true;
            }
        }
    }

    // 3. If we have fewer candidates than limit, add central squares
    var centralSquares = ['d4','d5','e4','e5','c3','c6','f3','f6','d3','d6','e3','e6'];
    for (var i = 0; i < centralSquares.length; i++) {
        if (Object.keys(candidates).length >= limit * 2) break;
        var sq = centralSquares[i];
        if (bug.get(sq) === null) {
            var rank = sq.charAt(1);
            if (pieceType === 'p' && (rank === '1' || rank === '8')) continue;
            candidates[sq] = true;
        }
    }

    // 4. Pawn-specific: adjacent files to enemy king
    if (pieceType === 'p' && enemyKing) {
        var kc = squareToCoords(enemyKing);
        for (var df = -1; df <= 1; df++) {
            var f = kc.file + df;
            if (f < 0 || f > 7) continue;
            for (var r = 1; r <= 7; r++) { // ranks 2-7 only (skip 1 and 8)
                var sq = coordsToSquare(f, r);
                if (sq && bug.get(sq) === null) {
                    candidates[sq] = true;
                }
            }
        }
    }

    // Score and sort candidates
    var scored = Object.keys(candidates).map(function(sq) {
        return { square: sq, score: scoreDrop(bug, pieceType, sq, sideToMove) };
    });
    scored.sort(function(a, b) { return b.score - a.score; });

    return scored.slice(0, limit);
}

// ───────────────────── Full Position Evaluation ─────────────────────

/**
 * Evaluate a bughouse position.
 *
 * @param {string} fen - FEN of the board to evaluate
 * @param {Array} ourReserve - pieces our side can drop
 * @param {Array} opponentReserve - pieces opponent can drop
 * @param {string} sideToEval - 'w' or 'b'
 * @param {Object} [partnerInfo] - optional { partnerFen, partnerNeed, oppPartnerDanger }
 * @returns {number} centipawn-like score (positive = good for sideToEval)
 */
function evalPosition(fen, ourReserve, opponentReserve, sideToEval, partnerInfo) {
    var score = 0;

    // 1. Board evaluation (material + PST)
    score += evalBoard(fen, sideToEval);

    // 2. Pocket potential
    var bug = new Bug(fen);
    score += evalPocketPotential(bug, ourReserve, sideToEval);

    // 3. King drop safety
    score += evalKingDropSafety(fen, opponentReserve, sideToEval);

    // 4. Partner coupling bonus
    if (partnerInfo && partnerInfo.partnerNeed) {
        // Bonus for pieces in our reserve that partner needs
        var pn = partnerInfo.partnerNeed;
        if (ourReserve) {
            // Actually, reserve pieces go to the player who drops them,
            // not the partner. The partner receives pieces from captures.
            // So we don't directly add partner need for our own reserve.
        }
    }

    return score;
}

/**
 * Score a capture move considering partner need.
 * Returns an adjustment to the capture's value.
 *
 * @param {string} capturedType - piece type being captured
 * @param {Object} partnerNeed - {p: score, n: score, ...} from computePartnerNeed
 * @param {string} movedPieceType - piece type we're moving to make the capture
 * @param {Object} oppPartnerDanger - {p: danger, ...} from computeOpponentPartnerDanger
 * @param {boolean} likelyRecaptured - whether our piece is likely to be recaptured
 * @returns {number} adjustment score
 */
function teamCaptureAdjustment(capturedType, partnerNeed, movedPieceType, oppPartnerDanger, likelyRecaptured) {
    var adjustment = 0;
    var LAMBDA = 0.3;
    var MU = 0.25;

    // Bonus for capturing what partner needs
    if (partnerNeed && partnerNeed[capturedType]) {
        adjustment += LAMBDA * partnerNeed[capturedType];
    }

    // Penalty if our piece is likely recaptured and opponent's partner would benefit
    if (likelyRecaptured && oppPartnerDanger && oppPartnerDanger[movedPieceType]) {
        adjustment -= MU * oppPartnerDanger[movedPieceType];
    }

    return adjustment;
}

// ───────────────────── Exports ─────────────────────

module.exports = {
    // Evaluation
    evalPosition: evalPosition,
    evalBoard: evalBoard,
    evalPocketPotential: evalPocketPotential,
    evalKingDropSafety: evalKingDropSafety,

    // Partner coupling
    computePartnerNeed: computePartnerNeed,
    computeOpponentPartnerDanger: computeOpponentPartnerDanger,
    teamCaptureAdjustment: teamCaptureAdjustment,

    // Drop scoring & pruning
    scoreDrop: scoreDrop,
    getCandidateDropSquares: getCandidateDropSquares,

    // Helpers
    kingRing: kingRing,
    kingZone: kingZone,
    findKing: findKing,
    parseFenPieces: parseFenPieces,

    // Constants
    PIECE_VALUE: PIECE_VALUE,
    DROPPABLE: DROPPABLE
};
