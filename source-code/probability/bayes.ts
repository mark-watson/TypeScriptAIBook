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
  if (entries.length === 0) throw new Error("At least one hypothesis is required.");
  const total = entries.reduce((s, [, p]) => s + p, 0);
  if (total === 0) throw new Error("All priors are zero — cannot normalise.");
  return entries.map(([hypothesis, p]) => ({ hypothesis, probability: p / total }));
}

/** Return posteriors via Bayes' Theorem. */
export function update(model: BayesModel, likelihoodFn: LikelihoodFn): BayesModel {
  if (model.length === 0) throw new Error("Cannot update an empty model.");
  const raw = model.map(e => ({
    hypothesis: e.hypothesis,
    probability: likelihoodFn(e.hypothesis) * e.probability,
  }));
  const marginal = raw.reduce((s, e) => s + e.probability, 0);
  if (marginal === 0) throw new Error("Marginal likelihood is zero — evidence impossible under all hypotheses.");
  return raw.map(e => ({ hypothesis: e.hypothesis, probability: e.probability / marginal }));
}

/** Look up the posterior for a single hypothesis. */
export function posterior(model: BayesModel, hypothesis: string): number {
  const entry = model.find(e => e.hypothesis === hypothesis);
  if (!entry) throw new Error(`Hypothesis "${hypothesis}" not found.`);
  return entry.probability;
}

/**
 * Return the full posterior array.
 *
 * This is intentionally an identity function — it exists so that calling
 * code reads as `posteriors(model)` rather than just `model`, making the
 * semantic intent ("I want the full posterior distribution") explicit.
 */
export const posteriors = (model: BayesModel): BayesModel => model;

/** Return the MAP (maximum a posteriori) hypothesis. */
export function maximumAPosteriori(model: BayesModel): HypothesisEntry {
  if (model.length === 0) throw new Error("Cannot find MAP of an empty model.");
  return model.reduce((best, e) => e.probability >= best.probability ? e : best);
}
