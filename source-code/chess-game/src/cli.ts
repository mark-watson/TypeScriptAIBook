import { Board, Move, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
         SQUARE_NAMES, NAME_TO_SQUARE, pieceType, pieceColor, opponent } from './engine.js';
import { getBestMove, evaluate, nodesVisited } from './ai.js';
import * as readline from 'node:readline';

// Unicode chess pieces
const PIECE_GLYPHS: Record<number, string> = {
  [WHITE | KING]: '♔', [WHITE | QUEEN]: '♕', [WHITE | ROOK]: '♖',
  [WHITE | BISHOP]: '♗', [WHITE | KNIGHT]: '♘', [WHITE | PAWN]: '♙',
  [BLACK | KING]: '♚', [BLACK | QUEEN]: '♛', [BLACK | ROOK]: '♜',
  [BLACK | BISHOP]: '♝', [BLACK | KNIGHT]: '♞', [BLACK | PAWN]: '♟',
};

function printBoard(board: Board): void {
  const info: string[] = [];
  info.push(`\x1b[1;37mTurn: ${board.turn === WHITE ? 'White' : 'Black'}\x1b[0m`);
  info.push(`Move: ${board.fullmoveNumber}`);
  info.push(`50-move: ${board.halfmoveClock}`);
  if (board.isInCheck()) info.push('\x1b[1;31mIN CHECK!\x1b[0m');
  info.push(`EP: ${board.enPassantSquare === -1 ? '-' : SQUARE_NAMES[board.enPassantSquare]}`);
  let castling = '';
  if (board.castlingRights & 1) castling += 'K';
  if (board.castlingRights & 2) castling += 'Q';
  if (board.castlingRights & 4) castling += 'k';
  if (board.castlingRights & 8) castling += 'q';
  info.push(`Castling: ${castling || '-'}`);
  info.push(`Eval: ${(evaluate(board) / 100).toFixed(1)}`);

  console.log('');
  for (let rank = 7; rank >= 0; rank--) {
    const row: string[] = [`\x1b[90m${rank + 1}\x1b[0m `];
    for (let file = 0; file < 8; file++) {
      const sq = rank * 8 + file;
      const p = board.board[sq];
      const bg = (rank + file) % 2 === 0 ? '\x1b[48;5;237m' : '\x1b[48;5;94m';
      if (p === 0) {
        row.push(`${bg}  \x1b[0m`);
      } else {
        const color = pieceColor(p) === WHITE ? '\x1b[1;37m' : '\x1b[1;35m';
        row.push(`${bg}${color}${PIECE_GLYPHS[p]} \x1b[0m`);
      }
    }
    const extra = info[7 - rank];
    console.log(row.join('') + (extra ? `  ${extra}` : ''));
  }
  console.log('\x1b[90m  a b c d e f g h\x1b[0m\n');
}

function parseMove(board: Board, input: string): Move | null {
  const s = input.trim().toLowerCase();
  if (s.length < 4 || s.length > 5) return null;
  const from = NAME_TO_SQUARE[s.substring(0, 2)];
  const to = NAME_TO_SQUARE[s.substring(2, 4)];
  if (from === undefined || to === undefined) return null;
  const promChar = s.length === 5 ? s[4] : null;
  let promType = 0;
  if (promChar) {
    const map: Record<string, number> = { q: QUEEN, r: ROOK, b: BISHOP, n: KNIGHT };
    promType = map[promChar] ?? 0;
  }
  for (const m of board.getLegalMoves()) {
    if (m.from === from && m.to === to) {
      if (promType && m.promotion !== promType) continue;
      if (!promType && m.promotion && m.promotion !== QUEEN) continue; // default to queen promo
      return m;
    }
  }
  return null;
}

async function playGame(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise(resolve => rl.question(q, resolve));

  console.log('\n\x1b[1;36m=== Chess Game ===\x1b[0m\n');
  console.log('1. Play as White');
  console.log('2. Play as Black');
  console.log('3. Program vs Program');

  const modeStr = await ask('\nChoose mode (1-3): ');
  const mode = parseInt(modeStr) || 1;
  const humanColor = mode === 1 ? WHITE : mode === 2 ? BLACK : null;
  const depthStr = await ask('Program depth (1-6, default 3): ');
  const depth = Math.min(6, Math.max(1, parseInt(depthStr) || 3));

  const board = new Board();
  printBoard(board);

  while (true) {
    const legalMoves = board.getLegalMoves();
    if (legalMoves.length === 0) {
      if (board.isInCheck()) {
        const winner = board.turn === WHITE ? 'Black' : 'White';
        console.log(`\x1b[1;33mCheckmate! ${winner} wins.\x1b[0m`);
      } else {
        console.log('\x1b[1;33mStalemate! Draw.\x1b[0m');
      }
      break;
    }

    if (board.halfmoveClock >= 100) {
      console.log('\x1b[1;33m50-move rule! Draw.\x1b[0m');
      break;
    }

    // Program turn
    if (humanColor === null || board.turn !== humanColor) {
      console.log(`\x1b[90mProgram is thinking (depth ${depth})...\x1b[0m`);
      const startTime = performance.now();
      const [move, score] = getBestMove(board, depth);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`Program plays: ${move.uci()} | eval: ${(score / 100).toFixed(1)} | nodes: ${nodesVisited} | time: ${elapsed}s`);
      board.makeMove(move);
      printBoard(board);
      if (humanColor === null) await new Promise(r => setTimeout(r, 500));
      continue;
    }

    // Human turn
    const input = await ask('Your move (or help): ');
    switch (input.trim().toLowerCase()) {
      case 'exit':
      case 'quit':
        console.log('Goodbye.');
        rl.close();
        return;
      case 'help':
        console.log('Commands: <uci move> (e.g. e2e4), fen, setfen, legal, reset, help, exit');
        break;
      case 'fen':
        console.log(board.toFen());
        break;
      case 'setfen':
        const fen = await ask('Enter FEN: ');
        board.fromFen(fen);
        printBoard(board);
        break;
      case 'legal':
        console.log(legalMoves.map(m => m.uci()).join(' '));
        break;
      case 'reset':
        board.reset();
        printBoard(board);
        break;
      default:
        const move = parseMove(board, input);
        if (move) {
          board.makeMove(move);
          printBoard(board);
        } else {
          console.log('Invalid move. Try UCI format like e2e4, or "help" for commands.');
        }
    }
  }
  rl.close();
}

playGame().catch(console.error);
