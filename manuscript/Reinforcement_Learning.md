# Overview of Reinforcement Learning (Optional Material)

Reinforcement Learning has been used in various applications such as robotics, game playing, recommendation systems, and more. Reinforcement Learning (RL) is a broad topic and we will only cover basic aspects of RL.

No external libraries are required for this chapter, we implement Q-learning from scratch in TypeScript.

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
- **Bellman equation**: `V(s) = \max_a \left[ R(s,a) + \gamma \sum P(s' \mid s, a) V(s') \right]`$ where `\gamma`$ (gamma) is the discount factor.

The **discount factor** `\gamma`$ (between 0 and 1) controls how much the agent values future rewards versus immediate rewards.

### Solving MDPs: Value Iteration in TypeScript

We implement value iteration for a simple 3×3 grid world:

```typescript
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
```

## A Concrete Example: Q-Learning

When the transition and reward models are unknown, the agent must learn through trial and error. **Q-learning** is one of the simplest and most widely used model-free RL algorithms.

The Q-learning update rule is:

```latexmath
Q(s,a) \leftarrow Q(s,a) + \alpha \left[ r + \gamma \max_{a'} Q(s',a') - Q(s,a) \right]
```

We implement a FrozenLake-style environment and Q-learning agent entirely in TypeScript:

```typescript
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

I tagged this chapter as optional material because I believe most readers will get more immediate value from mastering deep learning and pre-trained models. But if you find yourself working on sequential decision-making problems, robotics, game AI, resource allocation, dynamic pricing, the RL toolkit becomes indispensable.

## Optional Practice Problems

To solidify your understanding of Markov Decision Processes (MDPs) and Q-learning, try implementing the following exercises using the code files in [source-code/reinforcement_learning](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/reinforcement_learning):

1. **Investigating Environment Stochasticity (FrozenLake)**
   In [frozen_lake_qlearning.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/reinforcement_learning/frozen_lake_qlearning.ts), the `FrozenLake` class has a `slippery` parameter (default `true`) that introduces randomness in action execution.
   - Modify the training script to run with `slippery = false`.
   - Compare the number of training episodes needed to reach a stable success rate of `1.0` vs. the slippery version.
   - Explain why the non-slippery version converges faster.

2. **Shortest Path Incentives via Step Penalties**
   Currently, in [frozen_lake_qlearning.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/reinforcement_learning/frozen_lake_qlearning.ts), the reward is only received upon reaching the goal (`1.0`), and normal cells give `0.0` reward. This means the agent has no incentive to find the fastest path, only a safe one.
   - Modify the `step` function to return a small negative reward (a "step penalty" of `-0.01` or `-0.02`) for transitions that do not end in a hole (`H`) or the goal (`G`).
   - Run the Q-learning algorithm again and observe if the average number of steps taken to reach the goal decreases.

3. **Analyzing Discount Factors in Value Iteration**
   In [mdp_demo.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/reinforcement_learning/mdp_demo.ts), value iteration is executed with a discount factor of `gamma = 0.9`.
   - Run the script with different values of `gamma`, such as `0.1` (highly short-sighted agent) and `0.99` (highly long-sighted agent).
   - Document how these changes affect:
     1. The final optimal policy.
     2. The values assigned to the states.
     3. The number of iterations required for convergence.

4. **Adding Obstacles/Holes to Grid World MDP**
   The 3×3 grid world in [mdp_demo.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/reinforcement_learning/mdp_demo.ts) has a goal state at index 8 (reward `10`) and a penalty state at index 5 (reward `-5`).
   - Introduce a new "obstacle" state at index 4 (the center cell) which the agent cannot walk through (i.e., any action trying to enter state 4 leaves the agent in its current state, and if the agent starts in state 4, it cannot leave).
   - Adjust the transition probability array `P` to enforce this obstacle boundary, run `valueIteration`, and print the updated optimal policy.
