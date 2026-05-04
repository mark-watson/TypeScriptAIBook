// mdp_demo.ts - Markov Decision Process with Value Iteration

function valueIteration(
  nStates: number,
  nActions: number,
  P: number[][][],    // P[action][state][nextState] = probability
  R: number[][],       // R[state][action] = reward
  gamma: number = 0.9,
  threshold: number = 1e-6
): { policy: number[]; V: number[]; iterations: number } {
  let V = new Array(nStates).fill(0);
  let policy = new Array(nStates).fill(0);
  let iterations = 0;

  while (true) {
    iterations++;
    const newV = new Array(nStates).fill(0);
    let maxDelta = 0;

    for (let s = 0; s < nStates; s++) {
      let bestValue = -Infinity;
      let bestAction = 0;

      for (let a = 0; a < nActions; a++) {
        let value = R[s][a];
        for (let sp = 0; sp < nStates; sp++) {
          value += gamma * P[a][s][sp] * V[sp];
        }
        if (value > bestValue) {
          bestValue = value;
          bestAction = a;
        }
      }
      newV[s] = bestValue;
      policy[s] = bestAction;
      maxDelta = Math.max(maxDelta, Math.abs(newV[s] - V[s]));
    }

    V = newV;
    if (maxDelta < threshold) break;
  }

  return { policy, V, iterations };
}

// --- Example: 3×3 Grid World ---
const nStates = 9;
const nActions = 4; // up, right, down, left

const P: number[][][] = Array.from({ length: nActions },
  () => Array.from({ length: nStates },
    () => new Array(nStates).fill(0)));

const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]];

for (let s = 0; s < nStates; s++) {
  const r = Math.floor(s / 3);
  const c = s % 3;
  for (let a = 0; a < nActions; a++) {
    const [dr, dc] = directions[a];
    const nr = r + dr;
    const nc = c + dc;
    const ns = (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) ? nr * 3 + nc : s;
    P[a][s][ns] = 1.0;
  }
}

// Rewards: +10 for goal (state 8), -5 for trap (state 5)
const R: number[][] = Array.from({ length: nStates },
  () => new Array(nActions).fill(0));
for (let a = 0; a < nActions; a++) {
  R[8][a] = 10.0;
  R[5][a] = -5.0;
}

const result = valueIteration(nStates, nActions, P, R, 0.9);
const arrows = ["↑", "→", "↓", "←"];

console.log("=== Custom 3×3 Grid World ===");
console.log("Optimal policy:");
for (let r = 0; r < 3; r++) {
  const row = Array.from({ length: 3 },
    (_, c) => `  ${arrows[result.policy[r * 3 + c]]}  `).join("");
  console.log(row);
}
console.log(`\nValue function: [${result.V.map(v => v.toFixed(2)).join(", ")}]`);
console.log(`Iterations: ${result.iterations}`);
