// frozen_lake_qlearning.ts - Q-Learning on FrozenLake from scratch

class FrozenLake {
  private state = 0;
  private map = ["S","F","F","F", "F","H","F","H", "F","F","F","H", "H","F","F","G"];
  nStates = 16; nActions = 4;

  constructor(private slippery = true) {}
  reset() { return this.state = 0; }

  step(action: number) {
    let a = action;
    if (this.slippery && Math.random() < 0.667) a = (action + (Math.random() < 0.5 ? -1 : 1) + 4) % 4;
    const [r, c] = [Math.floor(this.state / 4), this.state % 4];
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    const nr = Math.max(0, Math.min(3, r + dirs[a][0]));
    const nc = Math.max(0, Math.min(3, c + dirs[a][1]));
    this.state = nr * 4 + nc;
    const cell = this.map[this.state];
    return { nextState: this.state, reward: cell === "G" ? 1.0 : 0.0, done: cell === "H" || cell === "G" };
  }
}

function evaluate(env: FrozenLake, Q: number[][], episodes = 100) {
  let wins = 0;
  for (let i = 0; i < episodes; i++) {
    let s = env.reset(), done = false, steps = 0;
    while (!done && steps++ < 100) {
      const a = Q[s].indexOf(Math.max(...Q[s]));
      const r = env.step(a);
      s = r.nextState; done = r.done;
      if (done && r.reward === 1) wins++;
    }
  }
  return wins / episodes;
}

function qLearning(env: FrozenLake, episodes = 10000, alpha = 0.1, gamma = 0.99, eps = 1.0, decay = 0.999, minEps = 0.01) {
  const Q = Array.from({ length: env.nStates }, () => new Array(env.nActions).fill(0));
  for (let ep = 0; ep < episodes; ep++) {
    let s = env.reset(), done = false, steps = 0;
    while (!done && steps++ < 100) {
      const a = Math.random() < eps ? Math.floor(Math.random() * env.nActions) : Q[s].indexOf(Math.max(...Q[s]));
      const { nextState, reward, done: d } = env.step(a);
      done = d;
      Q[s][a] += alpha * (reward + gamma * Math.max(...Q[nextState]) - Q[s][a]);
      s = nextState;
    }
    eps = Math.max(minEps, eps * decay);
    if ((ep + 1) % 1000 === 0) console.log(`  Episode ${String(ep + 1).padStart(5)}: success = ${evaluate(env, Q).toFixed(2)}`);
  }
  return Q;
}

const env = new FrozenLake(true);
console.log(`=== Q-Learning on FrozenLake ===\nStates: ${env.nStates}, Actions: ${env.nActions}\n\nTraining:`);
const Q = qLearning(env);

const arrows = ["↑", "→", "↓", "←"];
console.log("\nLearned policy:");
for (let r = 0; r < 4; r++)
  console.log("  " + Array.from({ length: 4 }, (_, c) => arrows[Q[r * 4 + c].indexOf(Math.max(...Q[r * 4 + c]))]).join(""));

console.log(`\nFinal success rate (1000 episodes): ${evaluate(env, Q, 1000).toFixed(2)}`);
