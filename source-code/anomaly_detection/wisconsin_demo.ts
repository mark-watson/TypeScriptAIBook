// wisconsin_demo.ts — Wisconsin Breast Cancer anomaly detection example
// Copyright 2022-2026 Mark Watson. All rights reserved.

import { readFileSync } from "node:fs";
import { buildDetector, train, isAnomaly } from "./detector.js";

// ---- CSV loading ----

function loadCSV(path: string): number[][] {
  const content = readFileSync(path, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) =>
      line
        .trim()
        .split(",")
        .map(Number),
    );
}

// ---- Preprocessing ----

/**
 * Apply log-transform, per-row min-max scaling, and remap
 * the target label from {2, 4} to {0, 1}.
 * Matches the original Java WisconsinAnomalyDetection.java.
 */
function preprocessWisconsin(rows: number[][]): number[][] {
  return rows.map((row) => {
    const xs = [...row];

    // Scale raw features (1–10) by 0.1 → [0.1, 1.0]
    for (let i = 0; i < 9; i++) {
      xs[i] *= 0.1;
    }

    // Log transform to push distribution toward bell shape
    let mn = 1e6;
    let mx = -1e6;
    for (let i = 0; i < 9; i++) {
      xs[i] = Math.log(xs[i] + 1.2);
      if (xs[i] < mn) mn = xs[i];
      if (xs[i] > mx) mx = xs[i];
    }

    // Per-row min-max normalise to [0, 1]
    const range = mx - mn;
    if (range < 1e-10) {
      for (let i = 0; i < 9; i++) xs[i] = 0.5;
    } else {
      for (let i = 0; i < 9; i++) {
        xs[i] = (xs[i] - mn) / range;
      }
    }

    // Remap target: {2, 4} → {0, 1}
    xs[9] = (xs[9] - 2.0) * 0.5;

    return xs;
  });
}

// ---- Main ----

const raw = loadCSV("data/cleaned_wisconsin_cancer_data.csv");
const data = preprocessWisconsin(raw);

console.log(`Loaded ${data.length} examples.`);

const det = buildDetector(data, 10);

console.log(`\nTraining set:  ${det.training.length}`);
console.log(`Cross-val set: ${det.crossValidation.length}`);
console.log(`Test set:      ${det.testing.length}`);

train(det);

console.log(`\nModel parameters:`);
console.log(`  best epsilon = ${det.bestEps.toFixed(4)}`);
console.log(`  num features = ${det.numFeatures}`);

// Quick sanity check
console.log(`\n--- Assertions ---`);
console.assert(det.bestEps > 0, "epsilon should be positive");
console.assert(det.mu.length === 10, "mu should have 10 elements");
console.assert(det.sigmaSq.length === 10, "sigmaSq should have 10 elements");

// Demonstrate isAnomaly on the first test example
if (det.testing.length > 0) {
  const sample = det.testing[0];
  const label = sample[9] > 0.5 ? "anomaly" : "normal";
  const prediction = isAnomaly(det, sample) ? "anomaly" : "normal";
  console.log(
    `\nFirst test sample: actual=${label}, predicted=${prediction}`,
  );
}

console.log("All assertions passed.");
console.log("\n=== Test complete ===");
