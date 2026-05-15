// examples/frequentist_demo.ts — Frequentist medical-screening example
//
// Re-examines the same screening-test scenario from a purely
// frequentist standpoint:
//   1. Simulate a clinical trial (N = 100,000).
//   2. Chi-squared test of independence.
//   3. Wilson CI for positive predictive value (PPV).
//   4. Side-by-side comparison with the Bayesian posterior.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

import {
  chiSquaredTest,
  zTestProportion,
  confidenceIntervalProportion,
} from "../frequentist.js";
import { makeBayesModel, update } from "../bayes.js";

const PREVALENCE = 0.001;
const SENSITIVITY = 0.99;
const FALSE_POSITIVE_RATE = 0.05;

function simulateScreening(n: number = 100_000) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < n; i++) {
    const sick = Math.random() < PREVALENCE;
    const pos = Math.random() < (sick ? SENSITIVITY : FALSE_POSITIVE_RATE);
    if (sick && pos) tp++;
    else if (sick && !pos) fn++;
    else if (!sick && pos) fp++;
    else tn++;
  }
  return { tp, fp, tn, fn };
}

function medicalLikelihood(h: string): number {
  return h === "disease" ? SENSITIVITY : FALSE_POSITIVE_RATE;
}

// ---------- main demo -------------------------------------------------

console.log("\n================================================================");
console.log("  FREQUENTIST ANALYSIS: Medical Screening Test");
console.log("================================================================");

const { tp, fp, tn, fn } = simulateScreening(100_000);
const n = tp + fp + tn + fn;

console.log(`\n--- 1. Simulated Clinical Trial (N = ${n.toLocaleString()}) ---`);
console.log(`  True  Positives (TP): ${String(tp).padStart(6)}`);
console.log(`  False Positives (FP): ${String(fp).padStart(6)}`);
console.log(`  True  Negatives (TN): ${String(tn).padStart(6)}`);
console.log(`  False Negatives (FN): ${String(fn).padStart(6)}`);

// 2. Chi-squared test of independence
console.log("\n--- 2. Chi-Squared Test of Independence ---");
const r1 = tp + fp, r2 = fn + tn, c1 = tp + fn, c2 = fp + tn;
const eTp = (r1 * c1) / n;
const eFp = (r1 * c2) / n;
const eFn = (r2 * c1) / n;
const eTn = (r2 * c2) / n;
const chi = chiSquaredTest([tp, fp, fn, tn], [eTp, eFp, eFn, eTn]);
const pStr = chi.pValue < 1e-15
  ? "< 1e-15 (essentially zero)"
  : `= ${chi.pValue.toExponential(6)}`;
console.log(`  chi-squared = ${chi.chiSquared.toFixed(2)}   df = ${chi.df}   p-value ${pStr}`);
console.log("\n  Interpretation: the test result and disease status");
console.log("  are NOT independent (we reject H0).  But this only");
console.log("  means the *association exists* — it says nothing about");
console.log("  how strong it is or what it means for one patient.");

// 3. PPV with Wilson CI
const positives = tp + fp;
const ppv = positives === 0 ? 0 : tp / positives;
const ci = confidenceIntervalProportion(tp, positives);
console.log("\n--- 3. Positive Predictive Value (PPV) ---");
console.log(`  PPV = TP / (TP + FP) = ${tp} / ${positives} = ${ppv.toFixed(4)}  (${(100 * ppv).toFixed(2)} %)`);
console.log(`  95% Wilson CI for PPV: [${ci.lower.toFixed(4)}, ${ci.upper.toFixed(4)}]  (${(100 * ci.lower).toFixed(2)}% – ${(100 * ci.upper).toFixed(2)}%)`);

// 4. Z-test
console.log("\n--- 4. Z-Test: Positive Rate vs. Prevalence ---");
const zt = zTestProportion(positives, n, PREVALENCE);
console.log(`  Observed positive rate: ${(100 * positives / n).toFixed(4)}%`);
console.log(`  Hypothesised rate (prevalence): ${(100 * PREVALENCE).toFixed(4)}%`);
const zPStr = zt.pValue < 1e-15 ? "< 1e-15" : `= ${zt.pValue.toExponential(6)}`;
console.log(`  z = ${zt.z.toFixed(4)}   p-value ${zPStr}`);
console.log("\n  The positive rate far exceeds the disease prevalence");
console.log("  because of the 5% false-positive rate — most positives");
console.log("  are healthy people.");

// 5. Side-by-side
console.log("\n--- 5. Bayesian vs. Frequentist Side-by-Side ---");
const prior = makeBayesModel({ disease: PREVALENCE, healthy: 1 - PREVALENCE });
const updated = update(prior, medicalLikelihood);
const pDisease = updated.find((e) => e.hypothesis === "disease")!.probability;
console.log(`  Bayesian posterior P(disease | positive test) = ${pDisease.toFixed(4)}  (${(100 * pDisease).toFixed(2)}%)`);
console.log(`  Frequentist PPV from simulation             = ${ppv.toFixed(4)}  (${(100 * ppv).toFixed(2)}%)`);
console.log("\n  Both frameworks agree: a positive test on a rare disease");
console.log("  gives only about 2% probability of actual illness.");
console.log("  The chi-squared test's tiny p-value is real but misleading");
console.log("  if taken as evidence that the test is *useful* for diagnosis.");

console.log("\n================================================================");
console.log("  Key lesson: statistical significance (small p-value) and");
console.log("  practical significance (high PPV) are different things.");
console.log("================================================================");
