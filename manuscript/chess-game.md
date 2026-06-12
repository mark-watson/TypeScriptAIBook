# Chess Game with Alpha-Beta Search

Dear reader, I have been fascinated by game programming since the 1970s. In addition to writing many text adventure games, I wrote the simple Chess playing game that Apple Computer distributed on their Apple II demo cassette tape and I wrote a commercial product that played the game of Go (Honinbo Warrior, written in UCSD Pascal).

**Note: I utilized the DeepSeek v4 Pro model to help me write the software in this chapter.**

A chess engine is one of the classic challenges in AI programming. Unlike machine learning approaches that learn from data, a chess engine relies on **search** — exploring possible sequences of moves and counter-moves to find the best continuation from any given position. The challenge is that chess has a branching factor of roughly 35 legal moves per position, so a naive search to even 4 moves deep would examine over a million positions. The art of chess engine design lies in pruning the search tree aggressively without missing important tactics.

In this chapter we build a complete chess engine and interactive game from scratch in TypeScript. The engine handles all standard chess rules — castling, en passant, pawn promotion, check, checkmate, and stalemate — and includes an AI opponent powered by **negamax search with alpha-beta pruning**, a **transposition table**, and **iterative deepening**. The search reaches depth 4–6 in well under a second, which is strong enough to challenge a casual player.

The implementation uses only Node.js built-in modules — no external dependencies are required.

The examples for this chapter are in the directory **source-code/chess-game**.

## How a Chess Engine Works

Before diving into the code, let's understand the four components every chess engine needs:

1. **Board representation** — a data structure that stores piece positions, whose turn it is, castling rights, and other game state. It must support fast move execution and undo.

2. **Move generation** — given a board position, produce all legal moves the current player can make. This is the most mechanically complex part: pawns move differently from knights, bishops slide along diagonals, castling requires empty squares, and no move can leave your own king in check.

3. **Evaluation** — assign a numeric score to a position. Positive scores favor White, negative scores favor Black. The simplest evaluation just counts material (queen=9, rook=5, bishop=3.3, knight=3.2, pawn=1), but stronger engines also consider piece placement, pawn structure, and king safety.

4. **Search** — use the evaluation function to look ahead several moves and pick the best one. The minimax algorithm says: assume your opponent will pick the move that minimizes your score, so you should pick the move that maximizes your minimum future score. Alpha-beta pruning dramatically reduces the tree by skipping branches that can't affect the final result.

Our engine implements all four components, plus several enhancements that make the search stronger and faster.

## Project Structure

The code is split into four TypeScript files:

```
chess-game/
├── package.json
├── tsconfig.json
├── src/
│   ├── engine.ts    // Board, Move, FEN, move generation, Zobrist hashing
│   ├── ai.ts        // Evaluation, alpha-beta search, transposition table
│   ├── cli.ts       // Interactive terminal UI and game loop
│   └── perft.ts     // Move generator verification & hash correctness
└── README.md
```

## Walking Through the Code

### Bitwise Piece Encoding

Pieces are stored as integers in a 64-element `Int8Array`, where each byte encodes both the piece type and its color using bitwise flags:

| Field | Bits | Values |
|-------|------|--------|
| Type  | 0–2  | `PAWN=1`, `KNIGHT=2`, `BISHOP=3`, `ROOK=4`, `QUEEN=5`, `KING=6` |
| Color | 3–4  | `WHITE=8`, `BLACK=16` |

This means a white queen is stored as `8 | 5 = 13` and a black knight as `16 | 2 = 18`. Extracting the type uses `piece & 7` and the color uses `piece & 24`. Single-operation bitwise extraction is fast, and the compact encoding keeps the board at just 64 bytes.

```typescript
export const EMPTY = 0;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const TYPE_MASK = 7;
export const WHITE = 8, BLACK = 16;
const COLOR_MASK = 24;

export function pieceType(p: number): number { return p & TYPE_MASK; }
export function pieceColor(p: number): number { return p & COLOR_MASK; }
```

The `Board` class also maintains two `Set<number>` collections — one per side — that track which squares each player's pieces occupy. This avoids scanning the full 64-element array during move generation.

### Precomputed Move Tables

At module load time, the engine precomputes attack tables for every square. These are stored as arrays of arrays:

```typescript
export const KNIGHT_MOVES: number[][] = new Array(64);
export const KING_MOVES: number[][] = new Array(64);
export const ROOK_RAYS: number[][][] = new Array(64);
export const BISHOP_RAYS: number[][][] = new Array(64);
export const QUEEN_RAYS: number[][][] = new Array(64);
```

For each square, `KNIGHT_MOVES[sq]` contains up to 8 target squares — the L-shaped jumps a knight can make. `KING_MOVES[sq]` contains up to 8 neighboring squares. For sliding pieces, the ray tables are more structured: `ROOK_RAYS[sq]` contains 4 rays (north, south, east, west), each an array of squares from the starting square to the board edge. `BISHOP_RAYS[sq]` does the same for the four diagonals, and `QUEEN_RAYS[sq]` combines both.

These tables are computed once and reused for the entire run:

```typescript
(function precompute() {
  for (let sq = 0; sq < 64; sq++) {
    const r = sq >> 3, f = sq & 7;

    // Knight moves: 8 possible L-shapes
    const knightMoves: number[] = [];
    for (const [dr, df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nf = f + df;
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) knightMoves.push(nr * 8 + nf);
    }
    KNIGHT_MOVES[sq] = knightMoves;

    // Sliding rays: walk in each direction until board edge
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
    // ... bishop and queen rays follow the same pattern
  }
})();
```

Precomputation makes both move generation and attack detection fast. To check if a square is attacked by a rook, we walk each rook ray outward from the square — the first piece we encounter in each direction tells us if an enemy rook or queen is targeting it.

### The Move Class

Each move is represented by an immutable `Move` object:

```typescript
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
}
```

The `uci()` method returns the move in UCI format (e.g., `e2e4`, `e7e8q` for promotion), which is the standard protocol for chess engines. The extra fields — `isEnPassant`, `isCastling`, `isDoublePush` — are needed for correct board updates during `makeMove` and `unmakeMove`.

### Zobrist Hashing

Zobrist hashing assigns a random 64-bit number to each possible piece-on-square combination, one to the side to move, one to each castling rights configuration, and one to each en passant target file. The hash of a board position is the XOR of all these numbers for the relevant state.

The random numbers come from a deterministic seeded PRNG (Linear Congruential Generator), so the same seed always produces the same keys:

```typescript
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
export const ZOBRIST_EP: bigint[] = new Array(64);
```

The critical optimization is that Zobrist hashes are updated **incrementally** during `makeMove` rather than recomputed from scratch. When a piece moves from square A to square B, we XOR out the key for the piece at A and XOR in the key for the piece at B. The same pattern applies to castling rights, en passant, and side to move. This makes hash updates O(1) instead of O(64) — essential because the search tree calls `makeMove` millions of times.

### Making and Unmaking Moves

`makeMove` executes a move on the board and returns a lightweight `BoardState` snapshot:

```typescript
export interface BoardState {
  enPassantSquare: number;
  castlingRights: number;
  halfmoveClock: number;
  zobristHash: bigint;
}
```

Rather than deep-copying the entire board (which would be prohibitively slow during search), `makeMove` captures these four volatile fields before mutating the board. `unmakeMove` restores them and reverses the board mutations — all in constant time:

```typescript
makeMove(move: Move): BoardState {
  const state: BoardState = {
    enPassantSquare: this.enPassantSquare,
    castlingRights: this.castlingRights,
    halfmoveClock: this.halfmoveClock,
    zobristHash: this.zobristHash,
  };

  // XOR out old state from Zobrist hash
  this.zobristHash ^= ZOBRIST_SIDE;
  this.zobristHash ^= ZOBRIST_CASTLING[this.castlingRights];
  if (this.enPassantSquare !== -1) this.zobristHash ^= ZOBRIST_EP[this.enPassantSquare];
  this.zobristHash ^= ZOBRIST_PIECES[move.from][move.pieceMoved];

  // Clear from square, handle captures, place piece at destination
  this.board[move.from] = EMPTY;
  this.pieces[ci].delete(move.from);

  // Handle captures (regular and en passant)
  if (move.isEnPassant) {
    const capturedSq = move.to - (color === WHITE ? 8 : -8);
    this.board[capturedSq] = EMPTY;
    this.pieces[oi].delete(capturedSq);
    this.zobristHash ^= ZOBRIST_PIECES[capturedSq][capturedPiece];
  } else if (move.pieceCaptured) {
    this.board[move.to] = EMPTY;
    this.pieces[oi].delete(move.to);
    this.zobristHash ^= ZOBRIST_PIECES[move.to][move.pieceCaptured];
  }

  // Place piece at destination (with promotion if applicable)
  const finalPiece = move.promotion ? (color | move.promotion) : move.pieceMoved;
  this.board[move.to] = finalPiece;
  this.pieces[ci].add(move.to);
  this.zobristHash ^= ZOBRIST_PIECES[move.to][finalPiece];

  // Update king square, castling rook if needed
  // Update castling rights, en passant, clocks
  this.turn = opponent(color);

  // XOR in new Zobrist state
  this.zobristHash ^= ZOBRIST_CASTLING[this.castlingRights];
  if (this.enPassantSquare !== -1) this.zobristHash ^= ZOBRIST_EP[this.enPassantSquare];

  return state;
}
```

The `unmakeMove` method reverses every mutation: it restores the captured piece (if any), moves the rook back for castling, restores the board square, piece sets, king location, Zobrist hash, castling rights, en passant square, halfmove clock, and turn. Both methods handle en passant captures and all four castling configurations.

### Move Generation: Pseudo-Legal and Legal

The engine generates moves in two stages. First, `getPseudoLegalMoves` produces all moves that follow the piece movement rules without checking whether they leave the king in check:

```typescript
getPseudoLegalMoves(): Move[] {
  const moves: Move[] = [];
  const color = this.turn;
  const forward = color === WHITE ? 8 : -8;  // +8 for White, -8 for Black

  for (const sq of this.pieces[colorIdx(color)]) {
    const piece = this.board[sq];
    const ptype = pieceType(piece);

    if (ptype === PAWN) {
      const pushSq = sq + forward;
      if (this.board[pushSq] === EMPTY) {
        // Check for promotion on the back rank
        if ((pushSq >> 3) === promoRank) {
          for (const pp of [QUEEN, ROOK, BISHOP, KNIGHT]) {
            moves.push(new Move(sq, pushSq, piece, EMPTY, pp));
          }
        } else {
          moves.push(new Move(sq, pushSq, piece));
          // Double push from starting rank
          if (r === startRank && this.board[pushSq + forward] === EMPTY) {
            moves.push(new Move(sq, pushSq + forward, piece, EMPTY, EMPTY, false, false, true));
          }
        }
      }
      // Diagonal captures and en passant follow...
    } else if (ptype === KNIGHT) {
      for (const t of KNIGHT_MOVES[sq]) {
        const target = this.board[t];
        if (target === EMPTY) moves.push(new Move(sq, t, piece));
        else if (pieceColor(target) === opponent(color)) moves.push(new Move(sq, t, piece, target));
      }
    }
    // King moves, castling, and sliding pieces follow...
  }
  return moves;
}
```

Pawns are the most complex piece: they move forward (but not diagonally unless capturing), can double-push from the starting rank, promote on the back rank, and capture en passant. Knights and kings use the precomputed move tables directly. Sliding pieces (bishop, rook, queen) walk along their ray tables until they hit a piece — capturing an enemy or stopping before a friendly one.

Then `getLegalMoves` filters pseudo-legal moves by making each one on the board and checking whether the moving side's king is left in check:

```typescript
getLegalMoves(): Move[] {
  const legal: Move[] = [];
  for (const move of this.getPseudoLegalMoves()) {
    const state = this.makeMove(move);
    if (!this.isSquareAttacked(this.kingSquare[movingSide], this.turn)) {
      legal.push(move);
    }
    this.unmakeMove(move, state);
  }
  return legal;
}
```

This is the standard approach: generate all moves that look legal, then filter. It's simple, correct, and fast enough when combined with incremental make/unmake.

### Position Evaluation

The evaluation function assigns a score from White's perspective. It sums material values and piece-square table bonuses for each piece on the board:

```typescript
const PIECE_VALUES: Record<number, number> = {
  [PAWN]: 100, [KNIGHT]: 320, [BISHOP]: 330, [ROOK]: 500, [QUEEN]: 900, [KING]: 20000,
};

export function evaluate(board: Board): number {
  let score = 0;
  for (const sq of board.pieces[0]) { // White pieces
    const pt = pieceType(board.board[sq]);
    score += PIECE_VALUES[pt];
    if (pt !== KING) score += PST_TABLES[pt][sq];  // positional bonus
  }
  for (const sq of board.pieces[1]) { // Black pieces
    const pt = pieceType(board.board[sq]);
    score -= PIECE_VALUES[pt];
    if (pt !== KING) score -= PST_TABLES[pt][sq ^ 56];  // mirror for Black's perspective
  }
  // King safety: different table for middlegame vs endgame
  const endgame = isEndgame(board);
  const kingTable = endgame ? KING_END_PST : KING_MIDDLE_PST;
  // ... add king positional scores
  return board.turn === WHITE ? score : -score;  // score from side-to-move perspective
}
```

Piece-square tables (PSTs) are 64-element arrays that encode positional knowledge. For example, the pawn table rewards advanced pawns and penalizes isolated ones, the knight table encourages centralization, and the king tables encourage castling in the middlegame but centralizing in the endgame. Black's perspective uses `sq ^ 56`, which mirrors the square index vertically (a1↔a8).

The engine automatically detects the endgame transition: when total non-pawn, non-king material drops below 3000 centipawns (roughly a rook and a minor piece), the king switches from the middlegame table (tucked in the corner) to the endgame table (centralized to support passed pawns).

### Search: Negamax with Alpha-Beta Pruning

The core of the AI is the negamax search algorithm. Negamax is a symmetric formulation of minimax that exploits the zero-sum property of chess: a position that is +300 for White is −300 for Black. Instead of alternating between maximizing and minimizing, negamax always maximizes from the current player's perspective and negates the score each time the turn switches:

```typescript
function search(board: Board, depth: number, alpha: number, beta: number): number {
  nodesVisited++;

  // 50-move rule: draw
  if (board.halfmoveClock >= 100) return 0;

  // Terminal check: checkmate or stalemate
  const legalMoves = board.getLegalMoves();
  if (legalMoves.length === 0) {
    if (board.isInCheck()) return -30000 + (maxDepth - depth); // Checkmate
    return 0; // Stalemate
  }

  if (depth === 0) return quiescenceSearch(board, alpha, beta);

  let bestScore = -Infinity;
  for (const move of legalMoves) {
    const state = board.makeMove(move);
    const score = -search(board, depth - 1, -beta, -alpha);  // Negate: opponent's best is our worst
    board.unmakeMove(move, state);

    if (score > bestScore) bestScore = score;
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;  // Alpha-beta cutoff
  }
  return bestScore;
}
```

The key insight of alpha-beta pruning is in the last two lines: once we find a move that's "too good" for our opponent to allow (i.e., the score exceeds `beta`), we stop searching the remaining moves. Our opponent, playing optimally, would never let us reach this position, so further analysis is wasted effort. With proper move ordering, alpha-beta reduces the effective branching factor from 35 to roughly 6 — the difference between searching depth 4 and depth 8 in the same time.

The initial window is `(-Infinity, +Infinity)`, meaning the first move establishes a baseline and subsequent moves tighten the bounds.

### Quiescence Search

At depth 0, instead of calling the static evaluation immediately, the engine extends the search on captures and promotions:

```typescript
function quiescenceSearch(board: Board, alpha: number, beta: number): number {
  nodesVisited++;
  const standPat = evaluate(board);
  if (standPat >= beta) return beta;  // Position is already "good enough"
  if (standPat > alpha) alpha = standPat;

  const captures = board.getPseudoLegalMoves()
    .filter(m => m.pieceCaptured || m.promotion)
    .filter(m => { /* legality check: does not leave king in check */ });

  for (const move of captures) {
    const state = board.makeMove(move);
    const score = -quiescenceSearch(board, -beta, -alpha);
    board.unmakeMove(move, state);

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}
```

This resolves the **horizon effect** — the classic problem where a search stops right before a recapture, making a position look better than it actually is. By extending on captures, quiescence search ensures the static evaluation is applied only to "quiet" positions where no immediate tactical exchanges remain.

### Transposition Table

The transposition table is a `Map<bigint, TTEntry>` keyed by Zobrist hash. It caches search results so that if the same position is reached via a different move order, we can reuse the previous result instead of searching again:

```typescript
interface TTEntry {
  depth: number;
  score: number;
  flag: number;     // TT_EXACT, TT_ALPHA (upper bound), or TT_BETA (lower bound)
  bestMove: Move | null;
}

const transpositionTable = new Map<bigint, TTEntry>();
```

On lookup, if the cached entry was computed at sufficient depth:
- An exact score can be returned immediately, avoiding the subtree entirely.
- An upper bound (`TT_ALPHA`) means the true score is at most this value — if it's already below alpha, we can skip the search.
- A lower bound (`TT_BETA`) means the true score is at least this value — if it's already above beta, we get an immediate cutoff.

Checkmate scores are adjusted for distance from the root when storing and retrieving, so the engine prefers faster checkmates over slower ones:

```typescript
// Storing: add distance to mate
if (storedScore > 29000) storedScore += (maxDepth - depth);
else if (storedScore < -29000) storedScore -= (maxDepth - depth);
```

The transposition table is cleared when it exceeds 500,000 entries to bound memory usage.

### Iterative Deepening

The top-level `getBestMove` function searches progressively deeper, using the best move from each iteration to order moves in the next:

```typescript
export function getBestMove(board: Board, depth: number = 3): [Move, number] {
  let bestMove: Move | null = null;
  let bestScore = 0;

  for (let d = 1; d <= depth; d++) {
    maxDepth = d;
    // Search at depth d, using TT best move from previous iteration for ordering

    const legalMoves = board.getLegalMoves();
    const ttBest = transpositionTable.get(board.zobristHash)?.bestMove ?? null;
    legalMoves.sort((a, b) => moveValue(board, b, ttBest) - moveValue(board, a, ttBest));

    let alpha = -Infinity;
    for (const move of legalMoves) {
      const state = board.makeMove(move);
      const score = -search(board, d - 1, -Infinity, -alpha);
      board.unmakeMove(move, state);
      if (score > currentScore) { currentScore = score; currentBest = move; }
      if (score > alpha) alpha = score;
    }
    bestMove = currentBest;
    bestScore = currentScore;
  }
  return [bestMove!, bestScore];
}
```

Iterative deepening might seem wasteful — searching depth 1, then 2, then 3 — but it's actually faster than searching depth 3 directly. The shallower searches populate the transposition table with best moves, which then get ordered first in the deeper search. Since alpha-beta pruning is maximally effective when good moves are tried first, this ordering produces dramatically more cutoffs and reduces the overall node count.

### Move Ordering

The `moveValue` function assigns a score to each move for sorting before search:

```typescript
function moveValue(board: Board, move: Move, ttMove: Move | null): number {
  if (ttMove && move.equals(ttMove)) return 1_000_000;   // TT best move first
  if (move.pieceCaptured) {
    return 10_000 + PIECE_VALUES[pieceType(move.pieceCaptured)]
           - Math.floor(PIECE_VALUES[pieceType(move.pieceMoved)] / 100);  // MVV-LVA
  }
  if (move.promotion) return 8_000 + PIECE_VALUES[move.promotion];
  if (move.isCastling) return 1_000;
  // Positional delta for non-king pieces
  if (pt !== KING) return PST_TABLES[pt][move.to] - PST_TABLES[pt][move.from];
  return 0;
}
```

The priority scheme:
1. **TT move** (1,000,000) — the best move from the previous iteration, tried first.
2. **MVV-LVA captures** (10,000+) — Most Valuable Victim minus Least Valuable Attacker. Capturing a queen with a pawn gets a higher bonus than capturing a pawn with a queen.
3. **Promotions** (8,000 + piece value) — promoting to a queen is better than underpromotion.
4. **Castling** (1,000) — a positional bonus.
5. **Positional delta** — the difference in piece-square table value between the destination and origin squares. This encourages pieces to move toward better squares.

### The CLI Interface

The interactive terminal UI in `cli.ts` provides three game modes:

- **Play as White** — human moves first, program responds as Black.
- **Play as Black** — program plays White, human controls Black.
- **Program vs Program** — watch the AI play itself with a half-second pause between moves.

The board is rendered with Unicode chess glyphs on a checkered background using ANSI color codes. A sidebar shows the current turn, move number, 50-move clock, check indicator, en passant square, castling rights, and centipawn evaluation.

```typescript
const PIECE_GLYPHS: Record<number, string> = {
  [WHITE | KING]: '♔', [WHITE | QUEEN]: '♕', [WHITE | ROOK]: '♖',
  [WHITE | BISHOP]: '♗', [WHITE | KNIGHT]: '♘', [WHITE | PAWN]: '♙',
  [BLACK | KING]: '♚', [BLACK | QUEEN]: '♛', [BLACK | ROOK]: '♜',
  [BLACK | BISHOP]: '♝', [BLACK | KNIGHT]: '♞', [BLACK | PAWN]: '♟',
};
```

Commands are entered in UCI format (e.g., `e2e4`, `g1f3`, `e7e8q` for promotion). Additional commands include `fen` to display the current position in Forsyth-Edwards Notation, `setfen` to load an arbitrary position, `legal` to list all legal moves, `reset` to start a new game, and `help` to see all commands.

### Perft: Verifying Move Generation

The `perft.ts` file recursively counts legal move sequences from the starting position and compares against known values:

```typescript
function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of board.getLegalMoves()) {
    const state = board.makeMove(move);
    // Verify Zobrist hash consistency after makeMove
    const recomputed = board.computeZobristHash();
    if (recomputed !== board.zobristHash) { /* error */ }
    nodes += perft(board, depth - 1);
    board.unmakeMove(move, state);
    // Verify hash is restored after unmakeMove
    if (board.zobristHash !== state.zobristHash) { /* error */ }
  }
  return nodes;
}
```

The expected node counts from the starting position are:

| Depth | Expected Nodes | Meaning |
|:-----:|:--------------:|:--------|
| 1     | 20             | White's first moves |
| 2     | 400            | Black's replies |
| 3     | 8,902          | White's second moves |

Perft also validates Zobrist hash consistency: after every `makeMove` the incremental hash is compared against a full recomputation, and after every `unmakeMove` the restored hash is compared against the pre-move snapshot. This catches bugs in both move generation and hash updates.

## Running the Example

Install dependencies and run:

```bash
cd source-code/chess-game
npm install
npm start
```

Choose your mode, set the AI depth, and enter moves in UCI format. Here is a sample session:

```text
=== Chess Game ===

1. Play as White
2. Play as Black
3. Program vs Program

Choose mode (1-3): 1
Program depth (1-6, default 3): 4

  a b c d e f g h
Turn: White  Move: 1  50-move: 0  EP: -  Castling: KQkq  Eval: 0.0

Your move (or help): e2e4

Program is thinking (depth 4)...
Program plays: e7e5 | eval: 0.2 | nodes: 28471 | time: 0.3s

  a b c d e f g h
Turn: White  Move: 2  50-move: 0  EP: -  Castling: KQkq  Eval: -0.1

Your move (or help):
```

At depth 4 the program examines roughly 20,000–80,000 nodes per move in under a second. At depth 5 it becomes noticeably stronger but slower. The program-vs-program mode is a good way to watch the AI in action without having to think of moves yourself.

You can also run the perft test suite:

```bash
npm run perft
```

Expected output:

```text
Perft tests from starting position:

Depth 1: 20 nodes (expected 20) [PASS] 0.00s (20,000 nps)
Depth 2: 400 nodes (expected 400) [PASS] 0.00s (80,000 nps)
Depth 3: 8902 nodes (expected 8902) [PASS] 0.03s (296,733 nps)
```

## Wrap Up

We built a complete chess engine with an AI opponent — board representation, legal move generation, Zobrist hashing, incremental undo, position evaluation with piece-square tables, and a negamax search with alpha-beta pruning, transposition tables, iterative deepening, and quiescence search. The entire engine runs in Node.js with zero dependencies.

The design principles at work here apply far beyond chess:

1. **Precompute what you can.** Move tables and Zobrist keys are computed once at load time and reused millions of times.
2. **Make the hot path fast.** Incremental make/unmake and Zobrist updates avoid O(N) operations in the search loop.
3. **Prune aggressively but correctly.** Alpha-beta pruning is mathematically sound — it never changes the result of a full minimax search, yet it reduces the tree size exponentially.
4. **Order matters.** Iterative deepening and MVV-LVA capture ordering produce drastically more cutoffs, making the same search depth reachable in a fraction of the nodes.
5. **Cache results.** The transposition table eliminates redundant work when the same position is reached through different move sequences.

There are many ways to extend this engine — null move pruning, killer move heuristics, principal variation search, UCI protocol support for GUI integration, and an opening book are all natural next steps. But the core search architecture described here is the same one used by high-performance engines: the difference is in the details, not the design.
