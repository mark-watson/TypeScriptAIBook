// Piece representation
export const EMPTY = 0;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const TYPE_MASK = 7;
export const WHITE = 8, BLACK = 16;
const COLOR_MASK = 24;

export function pieceType(p: number): number { return p & TYPE_MASK; }
export function pieceColor(p: number): number { return p & COLOR_MASK; }
export function opponent(c: number): number { return c === WHITE ? BLACK : WHITE; }
function colorIdx(c: number): number { return c === WHITE ? 0 : 1; }

// Castling rights
export const WK = 1, WQ = 2, BK = 4, BQ = 8;

// Piece characters for FEN
const PIECE_CHARS: Record<number, string> = {
  [WHITE | PAWN]: 'P', [WHITE | KNIGHT]: 'N', [WHITE | BISHOP]: 'B',
  [WHITE | ROOK]: 'R', [WHITE | QUEEN]: 'Q', [WHITE | KING]: 'K',
  [BLACK | PAWN]: 'p', [BLACK | KNIGHT]: 'n', [BLACK | BISHOP]: 'b',
  [BLACK | ROOK]: 'r', [BLACK | QUEEN]: 'q', [BLACK | KING]: 'k',
};

// Square mapping: index 0-63 maps to algebraic notation a1..h8
export const SQUARE_NAMES: string[] = [];
export const NAME_TO_SQUARE: Record<string, number> = {};
for (let row = 0; row < 8; row++) {
  for (let col = 0; col < 8; col++) {
    const name = 'abcdefgh'[col] + '12345678'[row];
    const sq = row * 8 + col;
    SQUARE_NAMES[sq] = name;
    NAME_TO_SQUARE[name] = sq;
  }
}

export function fileOf(sq: number): number { return sq & 7; }
export function rankOf(sq: number): number { return sq >> 3; }

// Precomputed move tables
export const KNIGHT_MOVES: number[][] = new Array(64);
export const KING_MOVES: number[][] = new Array(64);
export const ROOK_RAYS: number[][][] = new Array(64);
export const BISHOP_RAYS: number[][][] = new Array(64);
export const QUEEN_RAYS: number[][][] = new Array(64);

(function precompute() {
  for (let sq = 0; sq < 64; sq++) {
    const r = sq >> 3, f = sq & 7;

    // Knights
    const knightMoves: number[] = [];
    for (const [dr, df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nf = f + df;
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) knightMoves.push(nr * 8 + nf);
    }
    KNIGHT_MOVES[sq] = knightMoves;

    // Kings
    const kingMoves: number[] = [];
    for (const [dr, df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = r + dr, nf = f + df;
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) kingMoves.push(nr * 8 + nf);
    }
    KING_MOVES[sq] = kingMoves;

    // Sliding rays
    const rookRays: number[][] = [];
    for (const [dr, df] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const ray: number[] = [];
      let nr = r + dr, nf = f + df;
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        ray.push(nr * 8 + nf);
        nr += dr; nf += df;
      }
      rookRays.push(ray);
    }
    ROOK_RAYS[sq] = rookRays;

    const bishopRays: number[][] = [];
    for (const [dr, df] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const ray: number[] = [];
      let nr = r + dr, nf = f + df;
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        ray.push(nr * 8 + nf);
        nr += dr; nf += df;
      }
      bishopRays.push(ray);
    }
    BISHOP_RAYS[sq] = bishopRays;

    QUEEN_RAYS[sq] = [...rookRays, ...bishopRays];
  }
})();

// Zobrist hashing — deterministic seeded 64-bit PRNG
function createRng(seed: number): () => bigint {
  let state = BigInt.asUintN(64, BigInt(seed) | 1n);
  return () => {
    state = BigInt.asUintN(64, state * 6364136223846793005n + 1442695040888963407n);
    return state;
  };
}

const rng = createRng(1337);
export const ZOBRIST_PIECES: bigint[][] = new Array(64);
for (let sq = 0; sq < 64; sq++) {
  ZOBRIST_PIECES[sq] = new Array(32);
  for (let p = 0; p < 32; p++) ZOBRIST_PIECES[sq][p] = rng();
}
export const ZOBRIST_SIDE = rng();
export const ZOBRIST_CASTLING: bigint[] = new Array(16);
for (let i = 0; i < 16; i++) ZOBRIST_CASTLING[i] = rng();
export const ZOBRIST_EP: bigint[] = new Array(64);
for (let i = 0; i < 64; i++) ZOBRIST_EP[i] = rng();

// Move
export class Move {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly pieceMoved: number,
    readonly pieceCaptured: number = EMPTY,
    readonly promotion: number = EMPTY,
    readonly isEnPassant: boolean = false,
    readonly isCastling: boolean = false,
    readonly isDoublePush: boolean = false,
  ) {}

  uci(): string {
    const promChars: Record<number, string> = { [QUEEN]: 'q', [ROOK]: 'r', [BISHOP]: 'b', [KNIGHT]: 'n' };
    const base = SQUARE_NAMES[this.from] + SQUARE_NAMES[this.to];
    return this.promotion ? base + promChars[this.promotion] : base;
  }

  equals(other: Move): boolean {
    return this.from === other.from && this.to === other.to && this.promotion === other.promotion;
  }

  toString(): string { return this.uci(); }
}

// BoardState snapshot for undo
export interface BoardState {
  enPassantSquare: number;
  castlingRights: number;
  halfmoveClock: number;
  zobristHash: bigint;
}

// Board
export class Board {
  board: Int8Array = new Int8Array(64);
  pieces: [Set<number>, Set<number>] = [new Set(), new Set()];
  kingSquare: [number, number] = [4, 60];
  turn: number = WHITE;
  castlingRights: number = WK | WQ | BK | BQ;
  enPassantSquare: number = -1;
  halfmoveClock: number = 0;
  fullmoveNumber: number = 1;
  zobristHash: bigint = 0n;

  constructor(fen?: string) {
    if (fen) this.fromFen(fen);
    else this.reset();
  }

  reset(): void {
    this.fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  }

  fromFen(fen: string): void {
    this.board.fill(0);
    this.pieces[0].clear();
    this.pieces[1].clear();

    const parts = fen.split(' ');
    const [placement, activeColor, castling, ep, halfmove, fullmove] = parts;

    let rank = 7, file = 0;
    for (const ch of placement) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (ch >= '1' && ch <= '8') { file += parseInt(ch); continue; }
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const typeMap: Record<string, number> = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
      const piece = color | typeMap[ch.toLowerCase()];
      const sq = rank * 8 + file;
      this.board[sq] = piece;
      this.pieces[colorIdx(color)].add(sq);
      file++;
    }

    this.turn = activeColor === 'w' ? WHITE : BLACK;

    this.castlingRights = 0;
    if (castling.includes('K')) this.castlingRights |= WK;
    if (castling.includes('Q')) this.castlingRights |= WQ;
    if (castling.includes('k')) this.castlingRights |= BK;
    if (castling.includes('q')) this.castlingRights |= BQ;

    this.enPassantSquare = ep === '-' ? -1 : NAME_TO_SQUARE[ep];
    this.halfmoveClock = parseInt(halfmove);
    this.fullmoveNumber = parseInt(fullmove);

    this.kingSquare[0] = this.findKing(WHITE);
    this.kingSquare[1] = this.findKing(BLACK);

    this.zobristHash = this.computeZobristHash();
  }

  private findKing(color: number): number {
    for (const sq of this.pieces[colorIdx(color)]) {
      if (this.board[sq] === (color | KING)) return sq;
    }
    return -1;
  }

  toFen(): string {
    const ranks: string[] = [];
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0, row = '';
      for (let file = 0; file < 8; file++) {
        const p = this.board[rank * 8 + file];
        if (p === EMPTY) { empty++; }
        else {
          if (empty) { row += empty; empty = 0; }
          row += PIECE_CHARS[p];
        }
      }
      if (empty) row += empty;
      ranks.push(row);
    }
    let castling = '';
    if (this.castlingRights & WK) castling += 'K';
    if (this.castlingRights & WQ) castling += 'Q';
    if (this.castlingRights & BK) castling += 'k';
    if (this.castlingRights & BQ) castling += 'q';
    if (!castling) castling = '-';
    const ep = this.enPassantSquare === -1 ? '-' : SQUARE_NAMES[this.enPassantSquare];
    return `${ranks.join('/')} ${this.turn === WHITE ? 'w' : 'b'} ${castling} ${ep} ${this.halfmoveClock} ${this.fullmoveNumber}`;
  }

  computeZobristHash(): bigint {
    let h = 0n;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.board[sq];
      if (p !== EMPTY) h ^= ZOBRIST_PIECES[sq][p];
    }
    if (this.turn === BLACK) h ^= ZOBRIST_SIDE;
    h ^= ZOBRIST_CASTLING[this.castlingRights];
    if (this.enPassantSquare !== -1) h ^= ZOBRIST_EP[this.enPassantSquare];
    return h;
  }

  isSquareAttacked(sq: number, attackerColor: number): boolean {
    const r = sq >> 3, f = sq & 7;

    // Pawn attacks
    const pawnDir = attackerColor === WHITE ? -8 : 8;
    for (const df of [-1, 1]) {
      const nf = f + df;
      if (nf < 0 || nf > 7) continue;
      const pawnSq = sq + pawnDir + df;
      if (pawnSq >= 0 && pawnSq < 64 && this.board[pawnSq] === (attackerColor | PAWN)) return true;
    }

    // Knight attacks
    for (const t of KNIGHT_MOVES[sq]) {
      if (this.board[t] === (attackerColor | KNIGHT)) return true;
    }

    // King attacks
    for (const t of KING_MOVES[sq]) {
      if (this.board[t] === (attackerColor | KING)) return true;
    }

    // Rook/Queen rays
    for (const ray of ROOK_RAYS[sq]) {
      for (const t of ray) {
        const p = this.board[t];
        if (p !== EMPTY) {
          if (pieceColor(p) === attackerColor && (pieceType(p) === ROOK || pieceType(p) === QUEEN)) return true;
          break;
        }
      }
    }

    // Bishop/Queen rays
    for (const ray of BISHOP_RAYS[sq]) {
      for (const t of ray) {
        const p = this.board[t];
        if (p !== EMPTY) {
          if (pieceColor(p) === attackerColor && (pieceType(p) === BISHOP || pieceType(p) === QUEEN)) return true;
          break;
        }
      }
    }

    return false;
  }

  isInCheck(color?: number): boolean {
    const c = color ?? this.turn;
    return this.isSquareAttacked(this.kingSquare[colorIdx(c)], opponent(c));
  }

  getPseudoLegalMoves(): Move[] {
    const moves: Move[] = [];
    const color = this.turn;
    const opp = opponent(color);
    const forward = color === WHITE ? 8 : -8;
    const startRank = color === WHITE ? 1 : 6;
    const promoRank = color === WHITE ? 7 : 0;
    const promoPieces = [QUEEN, ROOK, BISHOP, KNIGHT];

    for (const sq of this.pieces[colorIdx(color)]) {
      const piece = this.board[sq];
      const ptype = pieceType(piece);
      const r = sq >> 3, f = sq & 7;

      if (ptype === PAWN) {
        const pushSq = sq + forward;
        if (this.board[pushSq] === EMPTY) {
          if ((pushSq >> 3) === promoRank) {
            for (const pp of promoPieces) moves.push(new Move(sq, pushSq, piece, EMPTY, pp));
          } else {
            moves.push(new Move(sq, pushSq, piece));
            if (r === startRank) {
              const doubleSq = pushSq + forward;
              if (this.board[doubleSq] === EMPTY) {
                moves.push(new Move(sq, doubleSq, piece, EMPTY, EMPTY, false, false, true));
              }
            }
          }
        }

        for (const df of [-1, 1]) {
          const nf = f + df;
          if (nf < 0 || nf > 7) continue;
          const capSq = sq + forward + df;
          const target = this.board[capSq];
          if (target !== EMPTY && pieceColor(target) === opp) {
            if ((capSq >> 3) === promoRank) {
              for (const pp of promoPieces) moves.push(new Move(sq, capSq, piece, target, pp));
            } else {
              moves.push(new Move(sq, capSq, piece, target));
            }
          } else if (capSq === this.enPassantSquare) {
            const epCaptured = this.board[capSq - forward];
            moves.push(new Move(sq, capSq, piece, epCaptured, EMPTY, true));
          }
        }
      } else if (ptype === KNIGHT) {
        for (const t of KNIGHT_MOVES[sq]) {
          const target = this.board[t];
          if (target === EMPTY) moves.push(new Move(sq, t, piece));
          else if (pieceColor(target) === opp) moves.push(new Move(sq, t, piece, target));
        }
      } else if (ptype === KING) {
        for (const t of KING_MOVES[sq]) {
          const target = this.board[t];
          if (target === EMPTY) moves.push(new Move(sq, t, piece));
          else if (pieceColor(target) === opp) moves.push(new Move(sq, t, piece, target));
        }
        // Castling
        if (color === WHITE && sq === 4) {
          if ((this.castlingRights & WK) && this.board[5] === EMPTY && this.board[6] === EMPTY) {
            if (!this.isSquareAttacked(4, opp) && !this.isSquareAttacked(5, opp) && !this.isSquareAttacked(6, opp)) {
              moves.push(new Move(4, 6, piece, EMPTY, EMPTY, false, true));
            }
          }
          if ((this.castlingRights & WQ) && this.board[3] === EMPTY && this.board[2] === EMPTY && this.board[1] === EMPTY) {
            if (!this.isSquareAttacked(4, opp) && !this.isSquareAttacked(3, opp) && !this.isSquareAttacked(2, opp)) {
              moves.push(new Move(4, 2, piece, EMPTY, EMPTY, false, true));
            }
          }
        } else if (color === BLACK && sq === 60) {
          if ((this.castlingRights & BK) && this.board[61] === EMPTY && this.board[62] === EMPTY) {
            if (!this.isSquareAttacked(60, opp) && !this.isSquareAttacked(61, opp) && !this.isSquareAttacked(62, opp)) {
              moves.push(new Move(60, 62, piece, EMPTY, EMPTY, false, true));
            }
          }
          if ((this.castlingRights & BQ) && this.board[59] === EMPTY && this.board[58] === EMPTY && this.board[57] === EMPTY) {
            if (!this.isSquareAttacked(60, opp) && !this.isSquareAttacked(59, opp) && !this.isSquareAttacked(58, opp)) {
              moves.push(new Move(60, 58, piece, EMPTY, EMPTY, false, true));
            }
          }
        }
      } else {
        // Sliding pieces
        const rays = ptype === BISHOP ? BISHOP_RAYS[sq] :
                     ptype === ROOK   ? ROOK_RAYS[sq]   :
                                        QUEEN_RAYS[sq];
        for (const ray of rays) {
          for (const t of ray) {
            const target = this.board[t];
            if (target === EMPTY) {
              moves.push(new Move(sq, t, piece));
            } else {
              if (pieceColor(target) === opp) moves.push(new Move(sq, t, piece, target));
              break;
            }
          }
        }
      }
    }
    return moves;
  }

  getLegalMoves(): Move[] {
    const legal: Move[] = [];
    for (const move of this.getPseudoLegalMoves()) {
      const state = this.makeMove(move);
      if (!this.isSquareAttacked(this.kingSquare[colorIdx(pieceColor(move.pieceMoved))], this.turn)) {
        legal.push(move);
      }
      this.unmakeMove(move, state);
    }
    return legal;
  }

  makeMove(move: Move): BoardState {
    const state: BoardState = {
      enPassantSquare: this.enPassantSquare,
      castlingRights: this.castlingRights,
      halfmoveClock: this.halfmoveClock,
      zobristHash: this.zobristHash,
    };

    const color = pieceColor(move.pieceMoved);
    const opp = opponent(color);
    const ci = colorIdx(color);
    const oi = colorIdx(opp);

    // XOR out old state
    this.zobristHash ^= ZOBRIST_SIDE;
    this.zobristHash ^= ZOBRIST_CASTLING[this.castlingRights];
    if (this.enPassantSquare !== -1) this.zobristHash ^= ZOBRIST_EP[this.enPassantSquare];
    this.zobristHash ^= ZOBRIST_PIECES[move.from][move.pieceMoved];

    // Clear from square
    this.board[move.from] = EMPTY;
    this.pieces[ci].delete(move.from);

    // Handle captures
    if (move.isEnPassant) {
      const capturedSq = move.to - (color === WHITE ? 8 : -8);
      const capturedPiece = this.board[capturedSq];
      this.board[capturedSq] = EMPTY;
      this.pieces[oi].delete(capturedSq);
      this.zobristHash ^= ZOBRIST_PIECES[capturedSq][capturedPiece];
    } else if (move.pieceCaptured) {
      this.board[move.to] = EMPTY;
      this.pieces[oi].delete(move.to);
      this.zobristHash ^= ZOBRIST_PIECES[move.to][move.pieceCaptured];
    }

    // Place piece
    const finalPiece = move.promotion ? (color | move.promotion) : move.pieceMoved;
    this.board[move.to] = finalPiece;
    this.pieces[ci].add(move.to);
    this.zobristHash ^= ZOBRIST_PIECES[move.to][finalPiece];

    // Update king square
    if (pieceType(move.pieceMoved) === KING) {
      this.kingSquare[ci] = move.to;
    }

    // Move castling rook
    if (move.isCastling) {
      let rookFrom: number, rookTo: number;
      if (move.to === 6)      { rookFrom = 7; rookTo = 5; }
      else if (move.to === 2) { rookFrom = 0; rookTo = 3; }
      else if (move.to === 62) { rookFrom = 63; rookTo = 61; }
      else                     { rookFrom = 56; rookTo = 59; }
      const rook = color | ROOK;
      this.board[rookFrom] = EMPTY;
      this.pieces[ci].delete(rookFrom);
      this.zobristHash ^= ZOBRIST_PIECES[rookFrom][rook];
      this.board[rookTo] = rook;
      this.pieces[ci].add(rookTo);
      this.zobristHash ^= ZOBRIST_PIECES[rookTo][rook];
    }

    // Update castling rights
    if (pieceType(move.pieceMoved) === KING) {
      this.castlingRights &= color === WHITE ? ~(WK | WQ) : ~(BK | BQ);
    }
    if (move.from === 7 || move.to === 7) this.castlingRights &= ~WK;
    if (move.from === 0 || move.to === 0) this.castlingRights &= ~WQ;
    if (move.from === 63 || move.to === 63) this.castlingRights &= ~BK;
    if (move.from === 56 || move.to === 56) this.castlingRights &= ~BQ;

    // Update en passant
    this.enPassantSquare = move.isDoublePush ? move.to - (color === WHITE ? 8 : -8) : -1;

    // Clocks
    if (pieceType(move.pieceMoved) === PAWN || move.pieceCaptured) this.halfmoveClock = 0;
    else this.halfmoveClock++;

    if (color === BLACK) this.fullmoveNumber++;

    this.turn = opp;

    // XOR in new state
    this.zobristHash ^= ZOBRIST_CASTLING[this.castlingRights];
    if (this.enPassantSquare !== -1) this.zobristHash ^= ZOBRIST_EP[this.enPassantSquare];

    return state;
  }

  unmakeMove(move: Move, state: BoardState): void {
    const color = pieceColor(move.pieceMoved);
    const ci = colorIdx(color);
    const oi = colorIdx(opponent(color));

    this.enPassantSquare = state.enPassantSquare;
    this.castlingRights = state.castlingRights;
    this.halfmoveClock = state.halfmoveClock;
    this.zobristHash = state.zobristHash;
    this.turn = color;

    if (color === BLACK) this.fullmoveNumber--;

    const finalPiece = move.promotion ? (color | move.promotion) : move.pieceMoved;
    this.board[move.to] = EMPTY;
    this.pieces[ci].delete(move.to);

    this.board[move.from] = move.pieceMoved;
    this.pieces[ci].add(move.from);

    if (move.isEnPassant) {
      const capturedSq = move.to - (color === WHITE ? 8 : -8);
      this.board[capturedSq] = move.pieceCaptured;
      this.pieces[oi].add(capturedSq);
    } else if (move.pieceCaptured) {
      this.board[move.to] = move.pieceCaptured;
      this.pieces[oi].add(move.to);
    }

    if (pieceType(move.pieceMoved) === KING) {
      this.kingSquare[ci] = move.from;
    }

    if (move.isCastling) {
      let rookFrom: number, rookTo: number;
      if (move.to === 6)      { rookFrom = 7; rookTo = 5; }
      else if (move.to === 2) { rookFrom = 0; rookTo = 3; }
      else if (move.to === 62) { rookFrom = 63; rookTo = 61; }
      else                     { rookFrom = 56; rookTo = 59; }
      const rook = color | ROOK;
      this.board[rookTo] = EMPTY;
      this.pieces[ci].delete(rookTo);
      this.board[rookFrom] = rook;
      this.pieces[ci].add(rookFrom);
    }
  }

  printBoard(): void {
    for (let rank = 7; rank >= 0; rank--) {
      const row: string[] = [`${rank + 1} `];
      for (let file = 0; file < 8; file++) {
        const p = this.board[rank * 8 + file];
        row.push(p === EMPTY ? '.' : PIECE_CHARS[p]);
      }
      console.log(row.join(' '));
    }
    console.log('  a b c d e f g h');
  }
}
