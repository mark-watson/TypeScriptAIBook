// bayes.ts — Bayesian inference core
//
// A Bayes model is a normalised map of hypothesis → probability.
// update() applies Bayes' Theorem:
//   P(H | E) = P(E | H) · P(H) / Σ_h P(E | h) · P(h)
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

export interface HypothesisEntry { hypothesis: string; probability: number }
export type BayesModel = HypothesisEntry[];
export type LikelihoodFn = (hypothesis: string) => number;

/** Create a Bayes model from prior probabilities (auto-normalised). */
export function makeBayesModel(priors: Record<string, number>): BayesModel {
  const entries = Object.entries(priors);
  const total = entries.reduce((s, [, p]) => s + p, 0);
  if (total === 0) throw new Error("All priors are zero — cannot normalise.");
  return entries.map(([hypothesis, p]) => ({ hypothesis, probability: p / total }));
}

/** Return posteriors via Bayes' Theorem. */
export function update(model: BayesModel, likelihoodFn: LikelihoodFn): BayesModel {
  const raw = model.map(e => ({ hypothesis: e.hypothesis, probability: likelihoodFn(e.hypothesis) * e.probability }));
  const marginal = raw.reduce((s, e) => s + e.probability, 0);
  if (marginal === 0) throw new Error("Marginal likelihood is zero — evidence impossible under all hypotheses.");
  return raw.map(e => ({ hypothesis: e.hypothesis, probability: e.probability / marginal }));
}

/** Look up the posterior for a single hypothesis. */
export function posterior(model: BayesModel, hypothesis: string): number {
  const e = model.find(e => e.hypothesis === hypothesis);
  if (!e) throw new Error(`Hypothesis "${hypothesis}" not found.`);
  return e.probability;
}

/** Return the full posterior array. */
export const posteriors = (model: BayesModel): BayesModel => model;

/** Return the MAP hypothesis. */
export const maximumAPosteriori = (model: BayesModel): HypothesisEntry =>
  model.reduce((best, e) => e.probability >= best.probability ? e : best);
