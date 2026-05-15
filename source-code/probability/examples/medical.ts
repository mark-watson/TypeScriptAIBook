// examples/medical.ts — Medical-diagnosis worked example
// Copyright 2024-2026 Mark Watson. All rights reserved.

import { makeBayesModel, update, posteriors, maximumAPosteriori } from "../bayes.js";
import { pearsonR } from "../correlation.js";

const [PREVALENCE, SENSITIVITY, FPR] = [0.001, 0.99, 0.05];
const likelihood = (h: string) => h === "disease" ? SENSITIVITY : FPR;

// ---- Bayesian Analysis ----
const prior = makeBayesModel({ disease: PREVALENCE, healthy: 1 - PREVALENCE });
const updated = update(prior, likelihood);

console.log("\n=== Bayesian Analysis: Medical Screening Test ===");
console.log("Prior probabilities:");
for (const p of posteriors(prior)) console.log(`  P(${p.hypothesis}) = ${p.probability.toFixed(4)}`);

console.log("\nAfter a POSITIVE test result:");
for (const p of posteriors(updated))
  console.log(`  P(${p.hypothesis} | positive) = ${p.probability.toFixed(4)}  (${(100 * p.probability).toFixed(2)} %)`);

const map = maximumAPosteriori(updated);
console.log(`\nMAP hypothesis: ${map.hypothesis}`);
console.log("Key insight: despite 99% sensitivity, a positive test only yields ~1.9%");
console.log("probability of disease because prevalence is so low (0.1%).");

// ---- Correlation Analysis ----
const tests: number[] = [], diagnoses: number[] = [];
for (let i = 0; i < 100_000; i++) {
  const sick = Math.random() < PREVALENCE;
  tests.push(Math.random() < (sick ? SENSITIVITY : FPR) ? 1 : 0);
  diagnoses.push(sick ? 1 : 0);
}
const r = pearsonR(tests, diagnoses);
console.log(`\n=== Correlation Analysis (N = ${tests.length}) ===`);
console.log(`Pearson r(test-result, disease) = ${r.toFixed(4)}`);
console.log("Modest positive correlation — but correlation alone cannot tell you the");
console.log("probability for any individual patient. That requires Bayesian reasoning.");

console.log("\n=== Done. ===");
