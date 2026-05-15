# Probability — Example for Mark Watson's book "Artificial Intelligence Using TypeScript"

A from-scratch probability and statistics library covering both Bayesian and Frequentist methods.

## Modules

- **bayes.ts** — Bayesian inference: model creation, Bayes' Theorem update, MAP estimation
- **correlation.ts** — Pearson-r, Spearman-ρ, correlation matrix
- **frequentist.ts** — z-tests, chi-squared tests, Wilson confidence intervals

## Worked Examples

- **examples/medical.ts** — Bayesian medical screening + correlation analysis
- **examples/frequentist_demo.ts** — Frequentist analysis of the same scenario + side-by-side comparison

## Setup

```bash
npm install
```

## Run

```bash
npx tsx examples/medical.ts
npx tsx examples/frequentist_demo.ts
```
