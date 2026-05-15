// frequentist.ts — Frequentist hypothesis-testing toolkit
//
// Provides the core tools of null-hypothesis significance testing:
// z-tests, chi-squared tests, and confidence intervals.
//
// IMPORTANT CAVEAT (repeated deliberately):
// A small p-value tells you the observed data would be unlikely
// *if* the null hypothesis were true.  It does NOT tell you the
// probability that the null hypothesis is false, nor the probability
// that your alternative hypothesis is true.  Confusing these is the
// single most common error in applied statistics.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

// ======================================================================
//  Normal CDF approximation (Abramowitz & Stegun 26.2.17)
//
//  Maximum absolute error: 1.5 × 10⁻⁷
//  Input: z (real number)
//  Output: Φ(z) = P(Z ≤ z) for Z ~ N(0,1)
// ======================================================================

/**
 * Approximate the standard normal CDF Φ(z) using the
 * Abramowitz & Stegun 26.2.17 rational approximation.
 */
export function phiApprox(z: number): number {
  const p = 0.2316419;
  const b1 = 0.31938153;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const az = Math.abs(z);
  const tVal = 1.0 / (1.0 + p * az);
  const pdf = Math.exp(-0.5 * az * az) / Math.sqrt(2.0 * Math.PI);
  const cdf =
    1.0 -
    pdf *
      (b1 * tVal +
        b2 * tVal ** 2 +
        b3 * tVal ** 3 +
        b4 * tVal ** 4 +
        b5 * tVal ** 5);

  return z >= 0 ? cdf : 1.0 - cdf;
}

// ======================================================================
//  Chi-squared CDF approximation (Wilson–Hilferty, 1931)
// ======================================================================

/**
 * Approximate the chi-squared CDF P(X ≤ x) with `df` degrees of freedom,
 * using the Wilson–Hilferty normal approximation.
 */
export function chiSquaredCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  const k = df;
  const term = 2.0 / (9.0 * k);
  const zVal = ((x / k) ** (1.0 / 3.0) - (1.0 - term)) / Math.sqrt(term);
  return phiApprox(zVal);
}

// ======================================================================
//  Z-score
// ======================================================================

/** Compute the standard z-score: (observed − expected) / stdDev. */
export function zScore(
  observed: number,
  expected: number,
  sd: number,
): number {
  if (sd <= 0) throw new Error("stdDev must be positive.");
  return (observed - expected) / sd;
}

// ======================================================================
//  One-sample z-test for a proportion
// ======================================================================

/**
 * One-sample z-test for a binomial proportion.
 * Tests H₀: p = hypothesisedP against H₁: p ≠ hypothesisedP (two-tailed).
 *
 * Returns { z, pValue }.
 */
export function zTestProportion(
  successes: number,
  n: number,
  hypothesisedP: number,
): { z: number; pValue: number } {
  const p0 = hypothesisedP;
  const pHat = successes / n;
  const se = Math.sqrt((p0 * (1 - p0)) / n);
  const z = (pHat - p0) / se;
  const pValue = Math.min(2.0 * (1.0 - phiApprox(Math.abs(z))), 1.0);
  return { z, pValue };
}

// ======================================================================
//  Pearson's chi-squared test (goodness-of-fit)
// ======================================================================

/**
 * Pearson's chi-squared goodness-of-fit test.
 * `observed` and `expected` are equal-length arrays of non-negative counts.
 *
 * Returns { chiSquared, df, pValue }.
 * H₀: observed counts follow the expected distribution.
 */
export function chiSquaredTest(
  observed: number[],
  expected: number[],
): { chiSquared: number; df: number; pValue: number } {
  if (observed.length !== expected.length) {
    throw new Error("observed and expected must have the same length.");
  }
  const chi2 = observed.reduce((sum, o, i) => {
    const e = expected[i];
    return e === 0 ? sum : sum + (o - e) ** 2 / e;
  }, 0);
  const df = observed.length - 1;
  const pValue = Math.max(1.0 - chiSquaredCdf(chi2, df), 0);
  return { chiSquared: chi2, df, pValue };
}

// ======================================================================
//  Wilson score confidence interval for a proportion
// ======================================================================

/**
 * Return the z* critical value for a two-sided confidence level.
 */
export function zCritical(confidence: number): number {
  const table: Record<string, number> = {
    "0.9": 1.6449,
    "0.95": 1.96,
    "0.99": 2.5758,
  };
  const key = confidence.toString();
  if (table[key] !== undefined) return table[key];

  // Fallback: solve Φ(z) = (1+confidence)/2 by bisection.
  const target = (1.0 + confidence) / 2.0;
  let lo = 0;
  let hi = 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (phiApprox(mid) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Wilson score confidence interval for a binomial proportion.
 * More accurate than the Wald (normal-approximation) interval,
 * especially for small samples or extreme proportions.
 *
 * Returns { lower, upper }.
 */
export function confidenceIntervalProportion(
  successes: number,
  n: number,
  confidence: number = 0.95,
): { lower: number; upper: number } {
  const p = successes / n;
  const z = zCritical(confidence);
  const z2 = z * z;
  const denom = 1.0 + z2 / n;
  const centre = (p + z2 / (2.0 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1.0 - p)) / n + z2 / (4.0 * n * n))) / denom;
  return {
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
  };
}
