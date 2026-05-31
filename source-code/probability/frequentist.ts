// frequentist.ts — Frequentist hypothesis-testing toolkit
//
// IMPORTANT CAVEAT: A small p-value means data is unlikely *if* H0 is true.
// It does NOT give the probability H0 is false.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

// ── Result interfaces ──────────────────────────────────────────────────

export interface ZTestResult       { z: number; pValue: number }
export interface ChiSquaredResult  { chiSquared: number; df: number; pValue: number }
export interface ConfidenceInterval { lower: number; upper: number }

// ── Standard normal helpers ────────────────────────────────────────────

/** Standard normal CDF Φ(z) via Abramowitz & Stegun 26.2.17. Max error: 1.5×10⁻⁷. */
export function phiApprox(z: number): number {
  const [p, b1, b2, b3, b4, b5] = [
    0.2316419, 0.31938153, -0.356563782, 1.781477937, -1.821255978, 1.330274429,
  ];
  const az = Math.abs(z), t = 1 / (1 + p * az);
  const pdf = Math.exp(-0.5 * az * az) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);
  return z >= 0 ? cdf : 1 - cdf;
}

/** Chi-squared CDF via Wilson–Hilferty normal approximation. */
export function chiSquaredCdf(x: number, df: number): number {
  if (df <= 0) throw new Error("Degrees of freedom must be positive.");
  if (x <= 0) return 0;
  const term = 2 / (9 * df);
  return phiApprox(((x / df) ** (1 / 3) - (1 - term)) / Math.sqrt(term));
}

// ── Tests ──────────────────────────────────────────────────────────────

/** z-score: (observed − expected) / stdDev. */
export function zScore(observed: number, expected: number, sd: number): number {
  if (sd <= 0) throw new Error("stdDev must be positive.");
  return (observed - expected) / sd;
}

/** One-sample z-test for a binomial proportion (two-tailed). */
export function zTestProportion(successes: number, n: number, hypothesisedP: number): ZTestResult {
  if (n <= 0) throw new Error("Sample size n must be positive.");
  if (hypothesisedP <= 0 || hypothesisedP >= 1)
    throw new Error("hypothesisedP must be in the open interval (0, 1).");
  const se = Math.sqrt((hypothesisedP * (1 - hypothesisedP)) / n);
  const z = (successes / n - hypothesisedP) / se;
  return { z, pValue: Math.min(2 * (1 - phiApprox(Math.abs(z))), 1) };
}

/** Pearson's chi-squared goodness-of-fit test. */
export function chiSquaredTest(observed: number[], expected: number[]): ChiSquaredResult {
  if (observed.length !== expected.length) throw new Error("observed and expected must have the same length.");
  if (observed.length < 2) throw new Error("Need at least 2 categories.");
  if (expected.some(e => e < 0)) throw new Error("Expected counts must be non-negative.");
  const chi2 = observed.reduce((s, o, i) => {
    if (expected[i] === 0) {
      if (o !== 0) throw new Error(`Expected count is 0 for bin ${i}, but observed count is ${o}.`);
      return s;          // 0/0 — both zero, contributes nothing
    }
    return s + (o - expected[i]) ** 2 / expected[i];
  }, 0);
  const df = observed.length - 1;
  return { chiSquared: chi2, df, pValue: Math.max(1 - chiSquaredCdf(chi2, df), 0) };
}

/** One-sample t-test (two-tailed, large-sample z-approximation). */
export function tTestOneSample(
  sample: number[], hypothesisedMean: number,
): ZTestResult {
  if (sample.length < 2) throw new Error("Need at least 2 observations.");
  const n = sample.length;
  const m = sample.reduce((s, x) => s + x, 0) / n;
  const s = Math.sqrt(sample.reduce((ss, x) => ss + (x - m) ** 2, 0) / (n - 1));  // sample SD
  if (s === 0) return { z: 0, pValue: 1 };
  const z = (m - hypothesisedMean) / (s / Math.sqrt(n));
  return { z, pValue: Math.min(2 * (1 - phiApprox(Math.abs(z))), 1) };
}

// ── Confidence intervals ───────────────────────────────────────────────

/**
 * z* critical value for a two-sided confidence level.
 *
 * A small lookup table covers common levels; everything else is found
 * by bisection on phiApprox.
 */
export function zCritical(confidence: number): number {
  if (confidence <= 0 || confidence >= 1)
    throw new Error("Confidence level must be in (0, 1).");
  // Common levels — matched numerically to avoid string-based lookup.
  const table: [number, number][] = [[0.9, 1.6449], [0.95, 1.96], [0.99, 2.5758]];
  for (const [level, z] of table) {
    if (Math.abs(confidence - level) < 1e-12) return z;
  }
  const target = (1 + confidence) / 2;
  let lo = 0, hi = 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    phiApprox(mid) < target ? lo = mid : hi = mid;
  }
  return (lo + hi) / 2;
}

/** Wilson score confidence interval for a binomial proportion. */
export function confidenceIntervalProportion(
  successes: number, n: number, confidence = 0.95,
): ConfidenceInterval {
  if (n <= 0) throw new Error("Sample size n must be positive.");
  const p = successes / n, z = zCritical(confidence), z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}
