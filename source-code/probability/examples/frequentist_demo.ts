// examples/frequentist_demo.ts — Frequentist medical-screening example
// Copyright 2024-2026 Mark Watson. All rights reserved.

import { chiSquaredTest, zTestProportion, confidenceIntervalProportion } from "../frequentist.js";
import { makeBayesModel, update } from "../bayes.js";

const [PREVALENCE, SENSITIVITY, FPR] = [0.001, 0.99, 0.05];

function simulateScreening(n = 100_000) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < n; i++) {
    const sick = Math.random() < PREVALENCE;
    const pos = Math.random() < (sick ? SENSITIVITY : FPR);
    if (sick && pos) tp++; else if (sick) fn++; else if (pos) fp++; else tn++;
  }
  return { tp, fp, tn, fn };
}

console.log("\n================================================================");
console.log("  FREQUENTIST ANALYSIS: Medical Screening Test");
console.log("================================================================");

const { tp, fp, tn, fn } = simulateScreening();
const n = tp + fp + tn + fn;

console.log(`\n--- 1. Simulated Trial (N = ${n.toLocaleString()}) ---`);
console.log(`  TP: ${tp}  FP: ${fp}  TN: ${tn}  FN: ${fn}`);

// 2. Chi-squared test
const [r1, r2, c1, c2] = [tp + fp, fn + tn, tp + fn, fp + tn];
const chi = chiSquaredTest([tp, fp, fn, tn], [r1 * c1 / n, r1 * c2 / n, r2 * c1 / n, r2 * c2 / n]);
const pStr = chi.pValue < 1e-15 ? "< 1e-15" : `= ${chi.pValue.toExponential(6)}`;
console.log(`\n--- 2. Chi-Squared Test ---\n  χ² = ${chi.chiSquared.toFixed(2)}  df = ${chi.df}  p ${pStr}`);
console.log("  → Association exists, but says nothing about strength for one patient.");

// 3. PPV with Wilson CI
const positives = tp + fp, ppv = positives === 0 ? 0 : tp / positives;
const ci = confidenceIntervalProportion(tp, positives);
console.log(`\n--- 3. PPV ---\n  PPV = ${tp}/${positives} = ${(100 * ppv).toFixed(2)}%`);
console.log(`  95% Wilson CI: [${(100 * ci.lower).toFixed(2)}%, ${(100 * ci.upper).toFixed(2)}%]`);

// 4. Z-test
const zt = zTestProportion(positives, n, PREVALENCE);
console.log(`\n--- 4. Z-Test: Positive Rate vs. Prevalence ---`);
console.log(`  Observed: ${(100 * positives / n).toFixed(4)}%  Hypothesised: ${(100 * PREVALENCE).toFixed(4)}%`);
console.log(`  z = ${zt.z.toFixed(4)}  p ${zt.pValue < 1e-15 ? "< 1e-15" : `= ${zt.pValue.toExponential(6)}`}`);

// 5. Bayesian comparison
const prior = makeBayesModel({ disease: PREVALENCE, healthy: 1 - PREVALENCE });
const pDisease = update(prior, h => h === "disease" ? SENSITIVITY : FPR)
  .find(e => e.hypothesis === "disease")!.probability;
console.log(`\n--- 5. Bayesian vs. Frequentist ---`);
console.log(`  Bayesian P(disease|+)  = ${(100 * pDisease).toFixed(2)}%`);
console.log(`  Frequentist PPV        = ${(100 * ppv).toFixed(2)}%`);
console.log("  Both agree: ~2% actual illness probability despite tiny p-value.");

console.log("\n================================================================");
console.log("  Key lesson: statistical significance ≠ practical significance.");
console.log("================================================================");
