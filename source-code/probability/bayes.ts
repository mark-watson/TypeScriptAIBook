// bayes.ts — Bayesian inference core
//
// A Bayes model is a normalised map of hypothesis → probability.
// update() applies Bayes' Theorem:
//
//   P(H | E) = P(E | H) · P(H) / Σ_h P(E | h) · P(h)
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

/** A single hypothesis–probability pair. */
export interface HypothesisEntry {
  hypothesis: string;
  probability: number;
}

/** A Bayes model is an array of hypothesis–probability pairs that sum to 1. */
export type BayesModel = HypothesisEntry[];

/** A likelihood function returns P(evidence | hypothesis). */
export type LikelihoodFn = (hypothesis: string) => number;

/**
 * Create a Bayes model from an object mapping hypothesis names to prior
 * probabilities.  Priors are automatically normalised so they sum to 1.
 */
export function makeBayesModel(
  priors: Record<string, number>,
): BayesModel {
  const entries = Object.entries(priors);
  const total = entries.reduce((sum, [, p]) => sum + p, 0);
  if (total === 0) {
    throw new Error("All priors are zero — cannot normalise.");
  }
  return entries.map(([hypothesis, p]) => ({
    hypothesis,
    probability: p / total,
  }));
}

/**
 * Return a new model with posteriors computed via Bayes' Theorem.
 *
 * `likelihoodFn(hypothesis)` must return P(evidence | hypothesis).
 */
export function update(
  model: BayesModel,
  likelihoodFn: LikelihoodFn,
): BayesModel {
  const unnormalised = model.map((entry) => ({
    hypothesis: entry.hypothesis,
    probability: likelihoodFn(entry.hypothesis) * entry.probability,
  }));
  const marginal = unnormalised.reduce((sum, e) => sum + e.probability, 0);
  if (marginal === 0) {
    throw new Error(
      "Marginal likelihood is zero — evidence is impossible under all hypotheses.",
    );
  }
  return unnormalised.map((e) => ({
    hypothesis: e.hypothesis,
    probability: e.probability / marginal,
  }));
}

/** Look up the posterior for a single hypothesis. */
export function posterior(model: BayesModel, hypothesis: string): number {
  const entry = model.find((e) => e.hypothesis === hypothesis);
  if (!entry) {
    throw new Error(`Hypothesis "${hypothesis}" not found in model.`);
  }
  return entry.probability;
}

/** Return the full posterior array. */
export function posteriors(model: BayesModel): BayesModel {
  return model;
}

/** Return the hypothesis with the highest posterior probability. */
export function maximumAPosteriori(
  model: BayesModel,
): HypothesisEntry {
  return model.reduce((best, e) =>
    e.probability >= best.probability ? e : best
  );
}
