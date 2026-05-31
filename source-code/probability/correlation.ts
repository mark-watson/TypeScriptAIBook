// correlation.ts — Correlation helpers
//
// NOTE: Correlation measures *association*, NOT causation.
// A high |r| does not imply X causes Y.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

/** Arithmetic mean. */
export function mean(xs: number[]): number {
  if (xs.length === 0) throw new Error("Cannot compute the mean of an empty array.");
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Population standard deviation. */
export function stdDev(xs: number[]): number {
  if (xs.length === 0) throw new Error("Cannot compute stdDev of an empty array.");
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

/** Population covariance. */
export function covariance(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error("xs and ys must have the same length.");
  if (xs.length === 0) throw new Error("Cannot compute covariance of empty arrays.");
  const mx = mean(xs), my = mean(ys);
  return xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.length;
}

/** Rank array (1-based, average ties). */
export function rankList(xs: number[]): number[] {
  const indexed = xs.map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(xs.length);
  let i = 0;
  while (i < xs.length) {
    let j = i;
    while (j < xs.length && indexed[j].value === indexed[i].value) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranks[indexed[k].index] = avg;
    i = j;
  }
  return ranks;
}

/**
 * Pearson product-moment correlation coefficient.
 * WARNING: Measures linear association only.
 */
export function pearsonR(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error("xs and ys must have the same length.");
  if (xs.length < 2) throw new Error("Need at least 2 data points for a correlation.");
  const sx = stdDev(xs), sy = stdDev(ys);
  if (sx === 0 || sy === 0) return 0;      // constant series → no linear relationship
  return covariance(xs, ys) / (sx * sy);
}

/** Spearman rank-order correlation. */
export function spearmanRho(xs: number[], ys: number[]): number {
  return pearsonR(rankList(xs), rankList(ys));
}

/** Entry in a pairwise correlation matrix. */
export interface CorrelationEntry { a: string; b: string; r: number }

/** Pairwise Pearson-r matrix. */
export function correlationMatrix(data: Record<string, number[]>): CorrelationEntry[] {
  const names = Object.keys(data);
  return names.flatMap(a => names.map(b => ({ a, b, r: pearsonR(data[a], data[b]) })));
}
