// detector.ts — Gaussian anomaly detection engine
// Copyright 2022-2026 Mark Watson. All rights reserved.

const SQRT_2_PI = Math.sqrt(2 * Math.PI);

export interface Detector {
  numFeatures: number;
  mu: number[]; sigmaSq: number[];
  bestEps: number;
  training: number[][]; crossValidation: number[][]; testing: number[][];
}

/** Split examples into training (~60%), cross-validation, and test sets. */
export function splitData(examples: number[][], numFeatures: number) {
  const train: number[][] = [], cv: number[][] = [], test: number[][] = [];
  const oi = numFeatures - 1;
  for (const ex of examples) {
    if (Math.random() < 0.6) {
      if (ex[oi] < 0.5 || Math.random() < 0.1) train.push(ex);
    } else if (Math.random() < 0.7) cv.push(ex);
    else test.push(ex);
  }
  return { train, cv, test };
}

/** Per-feature mean. */
export function computeMu(examples: number[][], nf: number): number[] {
  const mu = new Array(nf).fill(0);
  if (!examples.length) return mu;
  for (const ex of examples) for (let f = 0; f < nf; f++) mu[f] += ex[f];
  for (let f = 0; f < nf; f++) mu[f] /= examples.length;
  return mu;
}

/** Per-feature variance (skips last column = target label). */
export function computeSigmaSq(examples: number[][], mu: number[], nf: number): number[] {
  const s2 = new Array(nf).fill(0);
  for (let f = 0; f < nf - 1; f++) {
    let sum = 0;
    for (const ex of examples) { const d = ex[f] - mu[f]; sum += d * d; }
    s2[f] = Math.max(sum / examples.length, 1e-10);
  }
  return s2;
}

/** Average Gaussian PDF p(x) across all features. */
export function gaussianP(x: number[], mu: number[], sigmaSq: number[], nf: number): number {
  let sum = 0;
  for (let f = 0; f < nf - 1; f++) {
    const s2 = sigmaSq[f], d = x[f] - mu[f];
    sum += (1 / (SQRT_2_PI * Math.sqrt(s2))) * Math.exp(-(d * d) / (2 * s2));
  }
  return sum / nf;
}

/** Build a detector from labelled examples. */
export function buildDetector(examples: number[][], numFeatures: number): Detector {
  const { train, cv, test } = splitData(examples, numFeatures);
  return {
    numFeatures, mu: computeMu(train, numFeatures),
    sigmaSq: new Array(numFeatures).fill(0), bestEps: 0.02,
    training: train, crossValidation: cv, testing: test,
  };
}

function trainHelper(det: Detector, epsilon: number): number {
  const { numFeatures: nf, training, mu, crossValidation } = det;
  det.sigmaSq = computeSigmaSq(training, mu, nf);
  let errors = 0;
  for (const x of crossValidation) {
    const prob = gaussianP(x, mu, det.sigmaSq, nf);
    const anomaly = x[nf - 1] > 0.5;
    if (anomaly ? prob > epsilon : prob < epsilon) errors++;
  }
  return errors;
}

/** Evaluate model on test data → { precision, recall, f1 }. */
export function testModel(det: Detector, epsilon: number) {
  const { numFeatures: nf, mu, sigmaSq, testing } = det;
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const x of testing) {
    const prob = gaussianP(x, mu, sigmaSq, nf);
    const anomaly = x[nf - 1] > 0.5;
    if (anomaly) { prob > epsilon ? fn++ : tp++; }
    else { prob < epsilon ? fp++ : tn++; }
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  console.log(`\n -- best epsilon = ${epsilon.toFixed(4)}`);
  console.log(` -- test examples  = ${testing.length}`);
  console.log(` -- TP=${tp} FP=${fp} FN=${fn} TN=${tn}`);
  console.log(` -- precision=${precision.toFixed(4)} recall=${recall.toFixed(4)} F1=${f1.toFixed(4)}`);
  return { precision, recall, f1 };
}

/** Sweep 200 epsilon values, pick best, evaluate on test set. */
export function train(det: Detector): Detector {
  let bestErr = 1e10, bestE = 0.001;
  for (let i = 0; i < 200; i++) {
    const eps = 0.001 + 0.005 * i;
    const err = trainHelper(det, eps);
    if (err <= bestErr) { bestErr = err; bestE = eps; }
  }
  console.log(`\n**** Best epsilon = ${bestE.toFixed(4)}`);
  det.bestEps = bestE;
  trainHelper(det, bestE);
  testModel(det, bestE);
  return det;
}

/** Return true if x is classified as an anomaly. */
export function isAnomaly(det: Detector, x: number[]): boolean {
  return gaussianP(x, det.mu, det.sigmaSq, det.numFeatures) < det.bestEps;
}
