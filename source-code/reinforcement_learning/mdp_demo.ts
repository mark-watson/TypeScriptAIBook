// mdp_demo.ts - Markov Decision Process with Value Iteration

function valueIteration(
  nS: number, nA: number,
  P: number[][][], R: number[][],
  gamma = 0.9, threshold = 1e-6,
) {
  let V = new Array(nS).fill(0), policy = new Array(nS).fill(0), iterations = 0;
  while (true) {
    iterations++;
    const newV = new Array(nS).fill(0);
    let maxDelta = 0;
    for (let s = 0; s < nS; s++) {
      let bestVal = -Infinity, bestA = 0;
      for (let a = 0; a < nA; a++) {
        let val = R[s][a];
        for (let sp = 0; sp < nS; sp++) val += gamma * P[a][s][sp] * V[sp];
        if (val > bestVal) { bestVal = val; bestA = a; }
      }
      newV[s] = bestVal; policy[s] = bestA;
      maxDelta = Math.max(maxDelta, Math.abs(newV[s] - V[s]));
    }
    V = newV;
    if (maxDelta < threshold) break;
  }
  return { policy, V, iterations };
}

// --- 3×3 Grid World ---
const [nS, nA] = [9, 4];
const P = Array.from({ length: nA }, () => Array.from({ length: nS }, () => new Array(nS).fill(0)));
const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];

for (let s = 0; s < nS; s++) {
  const [r, c] = [Math.floor(s / 3), s % 3];
  for (let a = 0; a < nA; a++) {
    const nr = r + dirs[a][0], nc = c + dirs[a][1];
    P[a][s][(nr >= 0 && nr < 3 && nc >= 0 && nc < 3) ? nr * 3 + nc : s] = 1;
  }
}

const R = Array.from({ length: nS }, () => new Array(nA).fill(0));
for (let a = 0; a < nA; a++) { R[8][a] = 10; R[5][a] = -5; }

const { policy, V, iterations } = valueIteration(nS, nA, P, R, 0.9);
const arrows = ["↑", "→", "↓", "←"];

console.log("=== Custom 3×3 Grid World ===\nOptimal policy:");
for (let r = 0; r < 3; r++)
  console.log(Array.from({ length: 3 }, (_, c) => `  ${arrows[policy[r * 3 + c]]}  `).join(""));
console.log(`\nValue function: [${V.map(v => v.toFixed(2)).join(", ")}]`);
console.log(`Iterations: ${iterations}`);
