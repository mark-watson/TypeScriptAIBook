// frequentist.ts — Frequentist hypothesis-testing toolkit
//
// IMPORTANT CAVEAT: A small p-value means data is unlikely *if* H0 is true.
// It does NOT give the probability H0 is false.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

/** Standard normal CDF Φ(z) via Abramowitz & Stegun 26.2.17. Max error: 1.5×10⁻⁷. */
export function phiApprox(z: number): number {
  const [p, b1, b2, b3, b4, b5] = [0.2316419, 0.31938153, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const az = Math.abs(z), t = 1 / (1 + p * az);
  const pdf = Math.exp(-0.5 * az * az) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);
  return z >= 0 ? cdf : 1 - cdf;
}

/** Chi-squared CDF via Wilson–Hilferty normal approximation. */
export function chiSquaredCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  const term = 2 / (9 * df);
  return phiApprox(((x / df) ** (1 / 3) - (1 - term)) / Math.sqrt(term));
}

/** z-score: (observed − expected) / stdDev. */
export function zScore(observed: number, expected: number, sd: number): number {
  if (sd <= 0) throw new Error("stdDev must be positive.");
  return (observed - expected) / sd;
}

/** One-sample z-test for a binomial proportion (two-tailed). */
export function zTestProportion(successes: number, n: number, hypothesisedP: number) {
  const se = Math.sqrt((hypothesisedP * (1 - hypothesisedP)) / n);
  const z = (successes / n - hypothesisedP) / se;
  return { z, pValue: Math.min(2 * (1 - phiApprox(Math.abs(z))), 1) };
}

/** Pearson's chi-squared goodness-of-fit test. */
export function chiSquaredTest(observed: number[], expected: number[]) {
  if (observed.length !== expected.length) throw new Error("observed and expected must have the same length.");
  const chi2 = observed.reduce((s, o, i) => expected[i] === 0 ? s : s + (o - expected[i]) ** 2 / expected[i], 0);
  const df = observed.length - 1;
  return { chiSquared: chi2, df, pValue: Math.max(1 - chiSquaredCdf(chi2, df), 0) };
}

/** z* critical value for a two-sided confidence level. */
export function zCritical(confidence: number): number {
  const table: Record<string, number> = { "0.9": 1.6449, "0.95": 1.96, "0.99": 2.5758 };
  if (table[String(confidence)]) return table[String(confidence)];
  const target = (1 + confidence) / 2;
  let lo = 0, hi = 5;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; phiApprox(mid) < target ? lo = mid : hi = mid; }
  return (lo + hi) / 2;
}

/** Wilson score confidence interval for a binomial proportion. */
export function confidenceIntervalProportion(successes: number, n: number, confidence = 0.95) {
  const p = successes / n, z = zCritical(confidence), z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}
