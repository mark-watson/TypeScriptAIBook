// frozen_lake_qlearning.ts - Q-Learning on FrozenLake from scratch

class FrozenLake {
  private size = 4;
  private map: string[];
  private state = 0;
  public nStates = 16;
  public nActions = 4;

  constructor(private isSlippery: boolean = true) {
    this.map = [
      "S", "F", "F", "F",   // S=start, F=frozen
      "F", "H", "F", "H",   // H=hole
      "F", "F", "F", "H",
      "H", "F", "F", "G",   // G=goal
    ];
  }

  reset(): number {
    this.state = 0;
    return this.state;
  }

  step(action: number): { nextState: number; reward: number; done: boolean } {
    let actualAction = action;
    if (this.isSlippery && Math.random() < 0.667) {
      const slip = Math.random() < 0.5 ? -1 : 1;
      actualAction = (action + slip + 4) % 4;
    }

    const r = Math.floor(this.state / this.size);
    const c = this.state % this.size;
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    const [dr, dc] = dirs[actualAction];
    const nr = Math.max(0, Math.min(this.size - 1, r + dr));
    const nc = Math.max(0, Math.min(this.size - 1, c + dc));
    this.state = nr * this.size + nc;

    const cell = this.map[this.state];
    const done = cell === "H" || cell === "G";
    const reward = cell === "G" ? 1.0 : 0.0;

    return { nextState: this.state, reward, done };
  }
}

function qLearning(
  env: FrozenLake,
  episodes: number = 10000,
  alpha: number = 0.1,
  gamma: number = 0.99,
  epsilon: number = 1.0,
  epsilonDecay: number = 0.999,
  minEpsilon: number = 0.01
): number[][] {
  const Q: number[][] = Array.from({ length: env.nStates },
    () => new Array(env.nActions).fill(0));

  for (let ep = 0; ep < episodes; ep++) {
    let state = env.reset();
    let done = false;
    let steps = 0;

    while (!done && steps < 100) {
      const action = Math.random() < epsilon
        ? Math.floor(Math.random() * env.nActions)
        : Q[state].indexOf(Math.max(...Q[state]));

      const { nextState, reward, done: d } = env.step(action);
      done = d;

      const bestNext = Math.max(...Q[nextState]);
      Q[state][action] += alpha * (reward + gamma * bestNext - Q[state][action]);

      state = nextState;
      steps++;
    }

    epsilon = Math.max(minEpsilon, epsilon * epsilonDecay);

    if ((ep + 1) % 1000 === 0) {
      const rate = evaluate(env, Q);
      console.log(
        `  Episode ${String(ep + 1).padStart(5)}: success rate = ${rate.toFixed(2)}`
      );
    }
  }

  return Q;
}

function evaluate(env: FrozenLake, Q: number[][], episodes = 100): number {
  let successes = 0;
  for (let i = 0; i < episodes; i++) {
    let state = env.reset();
    let done = false;
    let steps = 0;
    while (!done && steps < 100) {
      const action = Q[state].indexOf(Math.max(...Q[state]));
      const result = env.step(action);
      state = result.nextState;
      done = result.done;
      if (done && result.reward === 1.0) successes++;
      steps++;
    }
  }
  return successes / episodes;
}

// --- Main ---
console.log("=== Q-Learning on FrozenLake (slippery) ===");
const env = new FrozenLake(true);
console.log(`States: ${env.nStates}, Actions: ${env.nActions}\n`);
console.log("Training:");
const Q = qLearning(env);

const arrows = ["↑", "→", "↓", "←"];
console.log("\nLearned policy:");
for (let r = 0; r < 4; r++) {
  const row = Array.from({ length: 4 }, (_, c) => {
    const s = r * 4 + c;
    return arrows[Q[s].indexOf(Math.max(...Q[s]))];
  }).join("");
  console.log(`  ${row}`);
}

const finalRate = evaluate(env, Q, 1000);
console.log(`\nFinal success rate (1000 episodes): ${finalRate.toFixed(2)}`);
