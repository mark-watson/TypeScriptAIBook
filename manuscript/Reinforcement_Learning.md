# Overview of Reinforcement Learning (Optional Material)

Reinforcement Learning has been used in various applications such as robotics, game playing, recommendation systems, and more. Reinforcement Learning (RL) is a broad topic and we will only cover basic aspects of RL.

No external libraries are required for this chapter — we implement Q-learning from scratch in TypeScript.

The examples for this chapter are in the directory **source-code/reinforcement_learning**.

{width: "80%"}
![Architecture diagram for Q-Learning on FrozenLake and MDP Value Iteration](FIG_reinforcement_learning.jpg)

## Overview

Reinforcement Learning is a type of machine learning that is concerned with decision-making in dynamic and uncertain environments. RL uses the concept of an agent which interacts with its environment by taking actions and receiving feedback in the form of rewards or penalties. The goal of the agent is to learn a policy which is a mapping from states of the environment to actions with the goal of maximizing the expected cumulative reward over time.

There are several key components to RL:

- **Environment**: the system or "world" that the agent interacts with.
- **Agent**: the decision-maker that chooses actions based on its current state, the current environment, and its policy.
- **State**: a representation of the current environment, the parameters and trained policy of the agent, and possibly the visible actions of other agents in the environment.
- **Action**: a decision taken by the agent.
- **Reward**: a scalar value that the agent receives as feedback for its actions.

Reinforcement learning algorithms can be divided into two main categories: value-based and policy-based. In value-based RL the agent learns an estimate of the value of different states or state-action pairs which are then used to determine the optimal policy. In contrast, in policy-based RL the agent directly learns a policy without estimating the value of states or state-action pairs.

If you enjoy the overview material in this chapter I recommend that you consider investing the time in the Coursera RL specialization [https://www.coursera.org/learn/fundamentals-of-reinforcement-learning](https://www.coursera.org/learn/fundamentals-of-reinforcement-learning#instructors) taught by Martha and Adam White.

My favorite RL book is "Reinforcement Learning: An Introduction, second edition" by Richard Sutton and Andrew Barto, that can be read online for free at [http://www.incompleteideas.net/book/the-book-2nd.html](http://www.incompleteideas.net/book/the-book-2nd.html).

## An Introduction to Markov Decision Process

Before we can write a reinforcement learning agent, we need to understand the mathematical framework that RL is built upon: the **Markov Decision Process** (MDP). An MDP provides a formal way to model sequential decision-making problems where outcomes are partly random and partly under the control of a decision-maker.

Let's start by defining the key terms:

- **Sequential decision problem**: a problem where decisions are made in sequence over time, and each decision affects future states and rewards.
- **Fully observable**: the agent can see the complete state of the environment at each step.
- **Stochastic environment**: transitions between states are not deterministic.
- **Markov property**: the future depends only on the current state and action, not on the history.
- **Bellman equation**: V(s) = max_a [ R(s,a) + γ Σ P(s'|s,a) V(s') ] where γ (gamma) is the discount factor.

The **discount factor** γ (between 0 and 1) controls how much the agent values future rewards versus immediate rewards.

### Solving MDPs: Value Iteration in TypeScript

We implement value iteration for a simple 3×3 grid world:

```typescript
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

// Build transition matrix
const P: number[][][] = Array.from({ length: nActions },
  () => Array.from({ length: nStates },
    () => new Array(nStates).fill(0)));

const grid = Array.from({ length: 3 }, (_, r) =>
  Array.from({ length: 3 }, (_, c) => r * 3 + c));

const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // up, right, down, left

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
```

## A Concrete Example: Q-Learning

When the transition and reward models are unknown, the agent must learn through trial and error. **Q-learning** is one of the simplest and most widely used model-free RL algorithms.

The Q-learning update rule is:

Q(s,a) ← Q(s,a) + α [ r + γ · max_a' Q(s',a') — Q(s,a) ]

We implement a FrozenLake-style environment and Q-learning agent entirely in TypeScript:

```typescript
// frozen_lake_qlearning.ts - Q-Learning from scratch

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

  step(action: number): {
    nextState: number; reward: number; done: boolean
  } {
    let actualAction = action;
    if (this.isSlippery && Math.random() < 0.667) {
      // Slip: 1/3 chance of intended direction,
      // 1/3 each for perpendicular
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
      // Epsilon-greedy action selection
      const action = Math.random() < epsilon
        ? Math.floor(Math.random() * env.nActions)
        : Q[state].indexOf(Math.max(...Q[state]));

      const { nextState, reward, done: d } = env.step(action);
      done = d;

      const bestNext = Math.max(...Q[nextState]);
      Q[state][action] += alpha * (
        reward + gamma * bestNext - Q[state][action]
      );

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
```

The `qLearning` function implements the core algorithm. The epsilon-greedy strategy decays from 1.0 (pure exploration) to 0.01 over time.

{class: tip}
When learning RL, start with tabular methods (Q-learning on discrete environments) before moving to deep RL. The concepts transfer directly, but debugging is far easier when you can inspect every Q-value in a table.

## Reinforcement Learning Wrap-up

In this chapter we covered:

- **Markov Decision Processes**: the mathematical foundation of RL, including states, actions, rewards, transition probabilities, the Bellman equation, and discount factors.
- **Value Iteration**: computing optimal policies for known MDPs.
- **Q-learning**: a model-free algorithm that learns from experience without needing transition probabilities, implemented from scratch in TypeScript.
- **Exploration vs exploitation**: controlled by the epsilon-greedy strategy with decaying epsilon.

If this chapter sparked your interest, I encourage you to work through the Coursera specialization by Martha and Adam White and the Sutton/Barto book.

I tagged this chapter as optional material because I believe most readers will get more immediate value from mastering deep learning and pre-trained models. But if you find yourself working on sequential decision-making problems — robotics, game AI, resource allocation, dynamic pricing — the RL toolkit becomes indispensable.

