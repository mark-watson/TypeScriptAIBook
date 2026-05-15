// wisconsin_demo.ts — Wisconsin Breast Cancer anomaly detection example
// Copyright 2022-2026 Mark Watson. All rights reserved.

import { readFileSync } from "node:fs";
import { buildDetector, train, isAnomaly } from "./detector.js";

function loadCSV(path: string): number[][] {
  return readFileSync(path, "utf-8").trim().split("\n")
    .filter(l => l.trim().length > 0)
    .map(l => l.trim().split(",").map(Number));
}

/** Log-transform, per-row min-max scaling, remap target {2,4} → {0,1}. */
function preprocessWisconsin(rows: number[][]): number[][] {
  return rows.map(row => {
    const xs = row.map((v, i) => i < 9 ? v * 0.1 : v);
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < 9; i++) {
      xs[i] = Math.log(xs[i] + 1.2);
      if (xs[i] < mn) mn = xs[i];
      if (xs[i] > mx) mx = xs[i];
    }
    const range = mx - mn;
    for (let i = 0; i < 9; i++) xs[i] = range < 1e-10 ? 0.5 : (xs[i] - mn) / range;
    xs[9] = (xs[9] - 2.0) * 0.5;
    return xs;
  });
}

const data = preprocessWisconsin(loadCSV("data/cleaned_wisconsin_cancer_data.csv"));
console.log(`Loaded ${data.length} examples.`);

const det = buildDetector(data, 10);
console.log(`\nTraining set:  ${det.training.length}`);
console.log(`Cross-val set: ${det.crossValidation.length}`);
console.log(`Test set:      ${det.testing.length}`);

train(det);
console.log(`\nModel: bestEps=${det.bestEps.toFixed(4)}, features=${det.numFeatures}`);

console.assert(det.bestEps > 0, "epsilon should be positive");
console.assert(det.mu.length === 10, "mu should have 10 elements");

if (det.testing.length > 0) {
  const s = det.testing[0];
  console.log(`\nFirst test sample: actual=${s[9] > 0.5 ? "anomaly" : "normal"}, predicted=${isAnomaly(det, s) ? "anomaly" : "normal"}`);
}
console.log("All assertions passed.\n=== Test complete ===");
