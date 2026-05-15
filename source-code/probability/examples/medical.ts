// examples/medical.ts — Medical-diagnosis worked example
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

import {
  makeBayesModel,
  update,
  posteriors,
  maximumAPosteriori,
} from "../bayes.js";
import { pearsonR } from "../correlation.js";

const PREVALENCE = 0.001;
const SENSITIVITY = 0.99;
const FALSE_POSITIVE_RATE = 0.05;

function medicalLikelihood(hypothesis: string): number {
  if (hypothesis === "disease") return SENSITIVITY;
  if (hypothesis === "healthy") return FALSE_POSITIVE_RATE;
  throw new Error(`Unknown hypothesis: ${hypothesis}`);
}

function runBayesianAnalysis() {
  const prior = makeBayesModel({
    disease: PREVALENCE,
    healthy: 1.0 - PREVALENCE,
  });
  const updated = update(prior, medicalLikelihood);

  console.log("\n=== Bayesian Analysis: Medical Screening Test ===");
  console.log("Prior probabilities:");
  for (const p of posteriors(prior)) {
    console.log(`  P(${p.hypothesis}) = ${p.probability.toFixed(4)}`);
  }

  console.log("\nAfter a POSITIVE test result:");
  for (const p of posteriors(updated)) {
    console.log(
      `  P(${p.hypothesis} | positive) = ${p.probability.toFixed(4)}` +
        `  (${(100 * p.probability).toFixed(2)} %)`,
    );
  }

  const map = maximumAPosteriori(updated);
  console.log(`\nMAP hypothesis: ${map.hypothesis}`);
  console.log("\nKey insight: despite 99% sensitivity, a positive test");
  console.log("only yields about 1.9% probability of disease because the");
  console.log("disease is so rare (0.1% prevalence).  This is exactly");
  console.log("the kind of counter-intuitive result Bayes' Theorem reveals.");
  return updated;
}

function runCorrelationAnalysis() {
  const tests: number[] = [];
  const diagnoses: number[] = [];
  for (let i = 0; i < 100_000; i++) {
    const hasDisease = Math.random() < PREVALENCE;
    const testPositive = hasDisease
      ? Math.random() < SENSITIVITY
      : Math.random() < FALSE_POSITIVE_RATE;
    tests.push(testPositive ? 1 : 0);
    diagnoses.push(hasDisease ? 1 : 0);
  }
  const r = pearsonR(tests, diagnoses);
  console.log(`\n=== Correlation Analysis (N = ${tests.length}) ===`);
  console.log(`Pearson r(test-result, disease) = ${r.toFixed(4)}`);
  console.log("\nThis positive correlation is real but modest.  It shows");
  console.log("that the test result and disease status are associated,");
  console.log("but the correlation coefficient alone cannot tell you the");
  console.log("probability that any *individual* patient is sick — that");
  console.log("requires Bayesian reasoning with the base rate (prevalence).");
  console.log("\nCorrelation ≠ causation, and here, even correlation ≠");
  console.log("reliable individual prediction.");
  return r;
}

runBayesianAnalysis();
runCorrelationAnalysis();
console.log("\n=== Done. ===");
