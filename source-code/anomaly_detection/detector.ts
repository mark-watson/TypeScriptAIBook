// detector.ts — Gaussian anomaly detection engine
// Copyright 2022-2026 Mark Watson. All rights reserved.

const SQRT_2_PI = Math.sqrt(2 * Math.PI);

// ---- Data structures ----

export interface Detector {
  numFeatures: number;
  mu: number[];
  sigmaSq: number[];
  bestEps: number;
  training: number[][];
  crossValidation: number[][];
  testing: number[][];
}

// ---- Helpers ----

/**
 * Split examples into training (~60%), cross-validation, and test sets.
 * Training set is biased toward normal examples (target < 0.5) but
 * allows ~10% anomalies through so the model sees some variance.
 */
export function splitData(
  examples: number[][],
  numFeatures: number,
): { train: number[][]; cv: number[][]; test: number[][] } {
  const train: number[][] = [];
  const cv: number[][] = [];
  const test: number[][] = [];
  const outcomeIdx = numFeatures - 1;

  for (const ex of examples) {
    if (Math.random() < 0.6) {
      // Keep normal examples; allow ~10% anomalies into training
      if (ex[outcomeIdx] < 0.5 || Math.random() < 0.1) {
        train.push(ex);
      }
    } else if (Math.random() < 0.7) {
      cv.push(ex);
    } else {
      test.push(ex);
    }
  }

  return { train, cv, test };
}

/**
 * Compute per-feature mean over examples.
 */
export function computeMu(
  examples: number[][],
  numFeatures: number,
): number[] {
  const n = examples.length;
  const mu = new Array(numFeatures).fill(0);
  if (n === 0) return mu;

  for (const ex of examples) {
    for (let f = 0; f < numFeatures; f++) {
      mu[f] += ex[f];
    }
  }
  for (let f = 0; f < numFeatures; f++) {
    mu[f] /= n;
  }
  return mu;
}

/**
 * Compute per-feature variance over examples.
 * Skips the last column (target label).
 */
export function computeSigmaSq(
  examples: number[][],
  mu: number[],
  numFeatures: number,
): number[] {
  const n = examples.length;
  const sigmaSq = new Array(numFeatures).fill(0);

  for (let f = 0; f < numFeatures - 1; f++) {
    let sum = 0;
    for (const ex of examples) {
      const diff = ex[f] - mu[f];
      sum += diff * diff;
    }
    sigmaSq[f] = Math.max(sum / n, 1e-10);
  }
  return sigmaSq;
}

/**
 * Compute average Gaussian PDF p(x) across all features.
 *
 *   p(x_i) = (1 / (sqrt(2π) · σ)) · exp(-(x_i - μ)² / (2σ²))
 *
 * Returns the mean probability across all feature dimensions.
 */
export function gaussianP(
  x: number[],
  mu: number[],
  sigmaSq: number[],
  numFeatures: number,
): number {
  let sum = 0;
  for (let f = 0; f < numFeatures - 1; f++) {
    const s2 = sigmaSq[f];
    const sigma = Math.sqrt(s2);
    const diff = x[f] - mu[f];
    const exponent = -(diff * diff) / (2 * s2);
    sum += (1 / (SQRT_2_PI * sigma)) * Math.exp(exponent);
  }
  return sum / numFeatures;
}

// ---- Public API ----

/**
 * Build a detector from examples (array of number arrays).
 * The last column of each example is the target label
 * (0 = normal, 1 = anomaly).
 */
export function buildDetector(
  examples: number[][],
  numFeatures: number,
): Detector {
  const { train, cv, test } = splitData(examples, numFeatures);
  const mu = computeMu(train, numFeatures);

  return {
    numFeatures,
    mu,
    sigmaSq: new Array(numFeatures).fill(0),
    bestEps: 0.02,
    training: train,
    crossValidation: cv,
    testing: test,
  };
}

/**
 * One training pass: compute sigma-sq from training data,
 * then count cross-validation errors for the given epsilon.
 */
function trainHelper(det: Detector, epsilon: number): number {
  const { numFeatures, training, mu, crossValidation } = det;
  const s2 = computeSigmaSq(training, mu, numFeatures);
  det.sigmaSq = s2;

  let errors = 0;
  for (const x of crossValidation) {
    const prob = gaussianP(x, mu, s2, numFeatures);
    const target = x[numFeatures - 1];

    if (target > 0.5) {
      // actual anomaly — error if model says normal
      if (prob > epsilon) errors++;
    } else {
      // actual normal — error if model says anomaly
      if (prob < epsilon) errors++;
    }
  }
  return errors;
}

/**
 * Evaluate the model on held-out test data.
 * Returns { precision, recall, f1 } and prints a summary.
 */
export function testModel(
  det: Detector,
  epsilon: number,
): { precision: number; recall: number; f1: number } {
  const { numFeatures, mu, sigmaSq, testing } = det;
  let tp = 0, fp = 0, fn = 0, tn = 0;

  for (const x of testing) {
    const prob = gaussianP(x, mu, sigmaSq, numFeatures);
    const target = x[numFeatures - 1];

    if (target > 0.5) {
      // actual anomaly
      if (prob > epsilon) fn++;
      else tp++;
    } else {
      // actual normal
      if (prob < epsilon) fp++;
      else tn++;
    }
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  console.log();
  console.log(` -- best epsilon = ${epsilon.toFixed(4)}`);
  console.log(` -- test examples  = ${testing.length}`);
  console.log(` -- false positives = ${fp}`);
  console.log(` -- true positives  = ${tp}`);
  console.log(` -- false negatives = ${fn}`);
  console.log(` -- true negatives  = ${tn}`);
  console.log(` -- precision = ${precision.toFixed(4)}`);
  console.log(` -- recall    = ${recall.toFixed(4)}`);
  console.log(` -- F1        = ${f1.toFixed(4)}`);

  return { precision, recall, f1 };
}

/**
 * Train the detector by sweeping 200 epsilon values on
 * cross-validation data, then evaluate on test data.
 * Returns the trained detector (mutated in place).
 */
export function train(det: Detector): Detector {
  let bestErr = 1e10;
  let bestE = 0.001;

  for (let i = 0; i < 200; i++) {
    const eps = 0.001 + 0.005 * i;
    const err = trainHelper(det, eps);
    if (err <= bestErr) {
      bestErr = err;
      bestE = eps;
    }
  }

  console.log(`\n**** Best epsilon = ${bestE.toFixed(4)}`);
  det.bestEps = bestE;

  // Retrain with best epsilon to set sigmaSq
  trainHelper(det, bestE);
  // Evaluate on test set
  testModel(det, bestE);

  return det;
}

/**
 * Return true if feature-vector x is classified as an anomaly.
 */
export function isAnomaly(det: Detector, x: number[]): boolean {
  return (
    gaussianP(x, det.mu, det.sigmaSq, det.numFeatures) < det.bestEps
  );
}
