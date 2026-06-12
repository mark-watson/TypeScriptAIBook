# Chess Engine & AI Program (TypeScript)

An educational, high-performance chess engine and AI bot written in modern, idiomatic TypeScript. Runs on Node.js with zero runtime dependencies.

This project implements a complete chess board representation, legal move generator, evaluation system, and interactive command-line interface (CLI) to play against an AI player or watch the bot play against itself. It is a direct port of the Python reference implementation from the *Python AI Book*, optimized for clarity and speed in a TypeScript/Node.js environment.

---

## Features

### 1. Core Chess Engine (`src/engine.ts`)

- **Board Representation**: 64-element `Int8Array` with custom bitwise piece encoding (type in bits 0–2, color in bits 3–4). Companion `Set<number>` collections track piece locations per side for fast iteration.
- **Precomputed Move Tables**: Knight moves, king moves, and sliding piece rays (rook, bishop, queen) are precomputed at module load time as arrays of arrays.
- **Fully Legal Move Generator**: Supports all standard chess rules:
  - Castling (path-not-attacked verification, castling rights tracking)
  - En passant (capture and target square tracking)
  - Pawn double pushes from the starting rank
  - Underpromotion to queen, rook, bishop, or knight
- **Check, Mate, and Stalemate Detection**: Pseudo-legal moves are filtered by making each move on the board and verifying the moving king is not left in check.
- **Zobrist Hashing**: 64-bit deterministic Zobrist keys (seeded LCG PRNG) uniquely identify board states. Side-to-move, castling rights, en passant square, and piece positions are XORed incrementally during `makeMove` for O(1) hash updates.
- **Efficient Undo/Redo**: Incremental move execution captures volatile state in a lightweight `BoardState` snapshot before modifying the board. `unmakeMove` restores state in O(1) without any board cloning — critical for search performance.
- **FEN Parser & Generator**: Full round-trip support for Forsyth-Edwards Notation to load, save, and inspect arbitrary chess positions.

### 2. Chess AI Program (`src/ai.ts`)

- **Negamax Search with Alpha-Beta Pruning**: Symmetric minimax variant that exploits the zero-sum property (`score(white) = -score(black)`) to halve the code footprint while pruning irrelevant branches.
- **Transposition Table (TT)**: A `Map<bigint, TTEntry>` keyed by Zobrist hash caches evaluated nodes to avoid redundant subtree searches. Stores depth, score, node bound flag (exact, alpha, beta), and best move.
- **Iterative Deepening**: Progressively searches depth 1 through the target depth, seeding each iteration's move ordering with the TT best move from the previous shallower search. This produces dramatically more alpha-beta cutoffs.
- **Quiescence Search**: Extends the search on capture and promotion sequences to resolve the horizon effect, ensuring the static evaluation is applied only to "quiet" positions.
- **Smart Move Ordering**: Moves are sorted before search to maximize cutoffs:
  - **TT move first** (1,000,000 bonus) — the best move from the previous iteration
  - **MVV-LVA** for captures (Most Valuable Victim − Least Valuable Attacker)
  - **Promotion bonus** (8,000 + piece value)
  - **Castling bonus** (1,000)
  - **Positional delta** via piece-square table difference for non-king pieces
- **Piece-Square Tables (PSTs)**: Custom 64-element arrays encoding positional bonuses for each piece type. Black's perspective is computed by mirroring the square index with `sq ^ 56`.
- **Dynamic King Safety**: Differentiates between middlegame (king tucked in the corner behind pawns) and endgame (king centralized to support passed pawns), switching PST tables when total non-pawn/non-king material drops below 3000 centipawns.
- **Endgame Detection**: Automatically transitions to endgame evaluation when remaining material (excluding pawns and kings) totals 3000 or fewer centipawns.

### 3. Interactive CLI (`src/cli.ts`)

- **Three Game Modes**:
  1. **Play as White** — human moves first
  2. **Play as Black** — bot plays white, human controls black
  3. **Program vs Program** — watch the AI play itself with a half-second pause between moves
- **Visual Board Display**: ANSI color-coded terminal rendering with:
  - Unicode chess glyphs (♔♕♖♗♘♙ / ♚♛♜♝♞♟)
  - Checkered board background (dark/light squares)
  - Sidebar showing: active turn, move number, 50-move clock, check indicator, en passant target, castling rights, and centipawn evaluation
- **Configurable Depth**: Adjustable bot search depth (1–6, default 3)
- **Command System**: UCI move input (e.g. `e2e4`, `e7e8q`), `fen`, `setfen`, `legal`, `reset`, `help`, `exit`

### 4. Perft Test Suite (`src/perft.ts`)

- **Perft Testing**: Recursively traverses the move tree to verify exact node counts against known standards for the starting position.
- **Hash Correctness Assertions**: Validates that incremental Zobrist hashes match a fresh `computeZobristHash()` call after every `makeMove`, and that `unmakeMove` perfectly restores the original hash.

---

## Project Structure

```
chess-game/
├── src/
│   ├── engine.ts    # Board, Move, FEN, move generation, Zobrist hashing
│   ├── ai.ts        # Evaluation, alpha-beta search, transposition table
│   ├── cli.ts       # Interactive terminal UI and game loop
│   └── perft.ts     # Move generator verification & hash correctness
├── package.json     # Project metadata & scripts
├── tsconfig.json    # TypeScript configuration (strict, ES2022, ESM)
└── README.md
```

---

## Installation & Running

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18

### Setup

```bash
npm install
```

### Play the Game

```bash
npm start
```

Choose your mode (play as White, Black, or watch Program vs Program), set the AI depth, and enter moves in UCI format (e.g. `e2e4`, `g1f3`, `e7e8q` for promotion).

### Run Move Generation Tests

```bash
npm run perft
```

Verifies the engine against standard perft node counts and checks Zobrist hash integrity at every make/unmake step.

---

## Deep Dive: Engine Architecture

### Bitwise Piece Encoding

Pieces are stored as integers combining type and color via bitwise OR:

| Field | Bits | Values |
|-------|------|--------|
| Type  | 0–2  | `PAWN=1`, `KNIGHT=2`, `BISHOP=3`, `ROOK=4`, `QUEEN=5`, `KING=6` |
| Color | 3–4  | `WHITE=8`, `BLACK=16` |

Examples: `WHITE | QUEEN` = `8 | 5` = `13`, `BLACK | KNIGHT` = `16 | 2` = `18`.

Extraction uses bitwise AND: `piece & 7` for type, `piece & 24` for color.

Castling rights use bit flags: `WK=1`, `WQ=2`, `BK=4`, `BQ=8`.

### Zobrist Hashing

A seeded 64-bit LCG PRNG (`seed = 1337`) generates random keys at module load:

- `ZOBRIST_PIECES[64][32]` — one key per piece value (0–31) per square
- `ZOBRIST_SIDE` — XORed in when it is Black's turn
- `ZOBRIST_CASTLING[16]` — one key per castling rights bitmask (0–15)
- `ZOBRIST_EP[64]` — one key per possible en passant target file

During `makeMove`, the hash is updated incrementally:
1. XOR out: `ZOBRIST_SIDE`, old `ZOBRIST_CASTLING`, old `ZOBRIST_EP`, and the moving piece at its origin square
2. Execute the move on the board
3. XOR in: new `ZOBRIST_CASTLING` and new `ZOBRIST_EP`

This avoids recomputing the full 64-square hash on every move — an O(1) update instead of O(64).

### Incremental Move Undo

Rather than deep-copying the board (prohibitively slow during search), `makeMove` returns a lightweight `BoardState` snapshot:

```typescript
interface BoardState {
  enPassantSquare: number;
  castlingRights: number;
  halfmoveClock: number;
  zobristHash: bigint;
}
```

`unmakeMove(move, state)` restores these four fields, reverses the board mutations, and restores any captured pieces — all in O(1).

### Precomputed Move Tables

At module initialization, ray-cast tables are precomputed for every square:

- `KNIGHT_MOVES[sq]` — up to 8 target squares
- `KING_MOVES[sq]` — up to 8 target squares
- `ROOK_RAYS[sq]` — 4 rays (N, S, E, W), each a list of squares to the board edge
- `BISHOP_RAYS[sq]` — 4 rays (NE, NW, SE, SW)
- `QUEEN_RAYS[sq]` — 8 rays (rook + bishop combined)

Sliding piece move generation walks each ray until a piece blocks further progress. Attack detection uses the same ray tables for efficient "is this square attacked?" queries.

---

## AI Search & Evaluation Details

### Material Values

| Piece  | Value (centipawns) |
|--------|---------------------|
| Pawn   | 100                 |
| Knight | 320                 |
| Bishop | 330                 |
| Rook   | 500                 |
| Queen  | 900                 |
| King   | 20,000              |

### Iterative Deepening

The search runs from depth 1 to the target depth sequentially. After each iteration, the best move is stored in the transposition table with the `TT_EXACT` flag. When the next iteration begins, this move is ordered first — producing far more alpha-beta cutoffs than searching the target depth directly. In practice, searching depths 1+2+3 is often faster than searching depth 3 cold.

### Transposition Table

The `Map<bigint, TTEntry>` maps Zobrist hashes to:

| Field     | Description |
|-----------|-------------|
| `depth`   | Search depth at which this entry was computed |
| `score`   | Evaluation score (mate scores adjusted for distance-from-root) |
| `flag`    | `TT_EXACT` (0) = exact, `TT_ALPHA` (1) = upper bound, `TT_BETA` (2) = lower bound |
| `bestMove`| Best move found at this position |

On lookup, entries at sufficient depth can:
- Return immediately (`TT_EXACT`)
- Tighten the alpha/beta window (`TT_ALPHA` / `TT_BETA`)
- Trigger an early cutoff if the narrowed window crosses (`alpha >= beta`)

The table is cleared when it exceeds 500,000 entries to bound memory usage.

### Mate Score Adjustment

Checkmate scores are stored relative to the root to keep them valid across different search depths:

- **Storing**: `score + (maxDepth - depth)` for mate scores (> 29000 or < −29000)
- **Retrieving**: `score - (maxDepth - depth)`

This ensures the engine prefers faster checkmates over slower ones.

### Quiescence Search

When the main search reaches depth 0, instead of calling the static evaluation immediately, the engine extends the search on capture and promotion moves. This prevents the horizon effect — where a position appears favorable only because the search stopped before a recapture could be considered.

Delta cutoff pruning is implicit: if the stand-pat score (current static evaluation) already exceeds beta, the search returns immediately since the position is "good enough" for the side to move.

---

## Perft Benchmarks

Perft (Performance Test) recursively counts legal move sequences to verify correctness:

| Depth | Expected Nodes | Meaning | Status |
|:-----:|:--------------:|:--------|:------:|
| **1** | 20             | White's first moves | PASS |
| **2** | 400            | Black's replies | PASS |
| **3** | 8,902          | White's second moves | PASS |

Zobrist hash consistency is verified after every `makeMove` and `unmakeMove` during the traversal.

---

## Future Enhancements

- **Null move pruning** — pass (do nothing) and test if the position is still above beta; if so, prune the subtree
- **Killer moves / history heuristic** — remember moves that caused beta cutoffs at the same depth to order them first in sibling nodes
- **Principal variation search (PVS)** — search the first move with a full window, then use a zero-width window for remaining moves
- **UCI protocol support** — communicate with chess GUIs (Arena, Lichess, ChessBase) via the Universal Chess Interface
- **Opening book** — a small database of common opening lines to accelerate early-game play and provide variety
