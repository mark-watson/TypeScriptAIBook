import { Board } from './engine.js';

function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of board.getLegalMoves()) {
    const state = board.makeMove(move);
    // Verify Zobrist hash consistency
    const recomputed = board.computeZobristHash();
    if (recomputed !== board.zobristHash) {
      console.error(`Hash mismatch after ${move.uci()}: stored=${board.zobristHash} recomputed=${recomputed}`);
      process.exit(1);
    }
    nodes += perft(board, depth - 1);
    board.unmakeMove(move, state);
    // Verify hash restored
    if (board.zobristHash !== state.zobristHash) {
      console.error(`Hash not restored after unmake ${move.uci()}`);
      process.exit(1);
    }
  }
  return nodes;
}

function runPerft(): void {
  const board = new Board();
  const expected = [20, 400, 8902];

  console.log('Perft tests from starting position:\n');

  for (let depth = 1; depth <= 3; depth++) {
    const start = performance.now();
    const nodes = perft(board, depth);
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    const status = nodes === expected[depth - 1] ? 'PASS' : 'FAIL';
    const nps = Math.round(nodes / parseFloat(elapsed));
    console.log(`Depth ${depth}: ${nodes} nodes (expected ${expected[depth - 1]}) [${status}] ${elapsed}s (${nps.toLocaleString()} nps)`);
  }
}

runPerft();
