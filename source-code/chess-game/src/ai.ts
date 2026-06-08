import { Board, Move, BoardState, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
         pieceType, pieceColor, opponent, EMPTY } from './engine.js';

// Material values
const PIECE_VALUES: Record<number, number> = {
  [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330, [ROOK]: 500, [QUEEN]: 900, [KING]: 20000,
};

// Piece-square tables from White's perspective (sq 0=a1 .. 63=h8)
const PAWN_PST: number[] = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_PST: number[] = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_PST: number[] = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_PST: number[] = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

const QUEEN_PST: number[] = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const KING_MIDDLE_PST: number[] = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

const KING_END_PST: number[] = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

const PST_TABLES: Record<number, number[]> = {
  [PAWN]: PAWN_PST, [KNIGHT]: KNIGHT_PST, [BISHOP]: BISHOP_PST,
  [ROOK]: ROOK_PST, [QUEEN]: QUEEN_PST,
};

function isEndgame(board: Board): boolean {
  let material = 0;
  for (const pieces of board.pieces) {
    for (const sq of pieces) {
      const pt = pieceType(board.board[sq]);
      if (pt !== PAWN && pt !== KING) material += PIECE_VALUES[pt];
    }
  }
  return material <= 3000;
}

export function evaluate(board: Board): number {
  let score = 0;
  for (const sq of board.pieces[0]) { // White pieces
    const pt = pieceType(board.board[sq]);
    score += PIECE_VALUES[pt];
    if (pt !== KING) score += PST_TABLES[pt][sq];
  }
  for (const sq of board.pieces[1]) { // Black pieces
    const pt = pieceType(board.board[sq]);
    score -= PIECE_VALUES[pt];
    if (pt !== KING) score -= PST_TABLES[pt][sq ^ 56];
  }
  // King PST based on game phase
  const endgame = isEndgame(board);
  const kingTable = endgame ? KING_END_PST : KING_MIDDLE_PST;
  for (let ci = 0; ci < 2; ci++) {
    for (const sq of board.pieces[ci]) {
      if (pieceType(board.board[sq]) === KING) {
        score += (ci === 0 ? 1 : -1) * kingTable[ci === 0 ? sq : (sq ^ 56)];
      }
    }
  }
  return board.turn === WHITE ? score : -score;
}

function moveValue(board: Board, move: Move, ttMove: Move | null): number {
  if (ttMove && move.equals(ttMove)) return 1_000_000;
  if (move.pieceCaptured) {
    return 10_000 + PIECE_VALUES[pieceType(move.pieceCaptured)]
           - Math.floor(PIECE_VALUES[pieceType(move.pieceMoved)] / 100);
  }
  if (move.promotion) return 8_000 + PIECE_VALUES[move.promotion];
  if (move.isCastling) return 1_000;

  const pt = pieceType(move.pieceMoved);
  if (pt !== KING) {
    return PST_TABLES[pt][move.to] - PST_TABLES[pt][move.from];
  }
  return 0;
}

// Transposition table
const TT_EXACT = 0, TT_ALPHA = 1, TT_BETA = 2;

interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  bestMove: Move | null;
}

const transpositionTable = new Map<bigint, TTEntry>();

let maxDepth = 3;
let nodesVisited = 0;

function search(board: Board, depth: number, alpha: number, beta: number): number {
  nodesVisited++;

  if (board.halfmoveClock >= 100) return 0;

  // TT lookup
  const ttEntry = transpositionTable.get(board.zobristHash);
  let ttBestMove: Move | null = null;
  let originalAlpha = alpha;

  if (ttEntry && ttEntry.depth >= depth) {
    ttBestMove = ttEntry.bestMove;
    let score = ttEntry.score;
    // Adjust mate scores for distance from root
    if (score > 29000) score -= (maxDepth - depth);
    else if (score < -29000) score += (maxDepth - depth);

    if (ttEntry.flag === TT_EXACT) return score;
    if (ttEntry.flag === TT_ALPHA && score <= alpha) return score;
    if (ttEntry.flag === TT_BETA && score >= beta) return score;
    if (ttEntry.flag === TT_ALPHA) alpha = Math.max(alpha, score);
    if (ttEntry.flag === TT_BETA) beta = Math.min(beta, score);
    if (alpha >= beta) return score;
  }

  const legalMoves = board.getLegalMoves();
  if (legalMoves.length === 0) {
    if (board.isInCheck()) return -30000 + (maxDepth - depth); // Checkmate
    return 0; // Stalemate
  }

  if (depth === 0) return quiescenceSearch(board, alpha, beta);

  // Move ordering
  legalMoves.sort((a, b) => moveValue(board, b, ttBestMove) - moveValue(board, a, ttBestMove));

  let bestScore = -Infinity;
  let bestMove: Move | null = null;

  for (const move of legalMoves) {
    const state = board.makeMove(move);
    const score = -search(board, depth - 1, -beta, -alpha);
    board.unmakeMove(move, state);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }

  // Store in TT
  let flag: number;
  if (bestScore <= originalAlpha) flag = TT_BETA;
  else if (bestScore >= beta) flag = TT_ALPHA;
  else flag = TT_EXACT;

  let storedScore = bestScore;
  if (storedScore > 29000) storedScore += (maxDepth - depth);
  else if (storedScore < -29000) storedScore -= (maxDepth - depth);

  const existing = transpositionTable.get(board.zobristHash);
  if (!existing || depth >= existing.depth) {
    transpositionTable.set(board.zobristHash, { depth, score: storedScore, flag, bestMove });
  }

  return bestScore;
}

function quiescenceSearch(board: Board, alpha: number, beta: number): number {
  nodesVisited++;
  const standPat = evaluate(board);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = board.getPseudoLegalMoves().filter(m => m.pieceCaptured || m.promotion)
    .filter(m => {
      const state = board.makeMove(m);
      const legal = !board.isSquareAttacked(
        board.kingSquare[pieceColor(m.pieceMoved) === WHITE ? 0 : 1], board.turn);
      board.unmakeMove(m, state);
      return legal;
    });

  captures.sort((a, b) => moveValue(board, b, null) - moveValue(board, a, null));

  for (const move of captures) {
    const state = board.makeMove(move);
    const score = -quiescenceSearch(board, -beta, -alpha);
    board.unmakeMove(move, state);

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

export function getBestMove(board: Board, depth: number = 3): [Move, number] {
  // Trim TT if too large
  if (transpositionTable.size > 500_000) transpositionTable.clear();

  let bestMove: Move | null = null;
  let bestScore = 0;

  // Iterative deepening
  for (let d = 1; d <= depth; d++) {
    maxDepth = d;
    nodesVisited = 0;

    const legalMoves = board.getLegalMoves();
    const ttEntry = transpositionTable.get(board.zobristHash);
    const ttBest = ttEntry?.bestMove ?? null;
    legalMoves.sort((a, b) => moveValue(board, b, ttBest) - moveValue(board, a, ttBest));

    let alpha = -Infinity;
    const beta = Infinity;
    let currentBest: Move | null = null;
    let currentScore = -Infinity;

    for (const move of legalMoves) {
      const state = board.makeMove(move);
      const score = -search(board, d - 1, -beta, -alpha);
      board.unmakeMove(move, state);

      if (score > currentScore) {
        currentScore = score;
        currentBest = move;
      }
      if (score > alpha) alpha = score;
    }

    if (currentBest) {
      bestMove = currentBest;
      bestScore = currentScore;
      transpositionTable.set(board.zobristHash, {
        depth: d, score: currentScore, flag: TT_EXACT, bestMove: currentBest,
      });
    }
  }

  return [bestMove!, bestScore];
}

export { nodesVisited, maxDepth };
