// correlation.ts — Correlation helpers
//
// NOTE: Correlation measures *association*, NOT causation.
// A high |r| between X and Y does not imply that X causes Y,
// that Y causes X, or even that they share a direct mechanism.
// Confounders, selection bias, and reverse causation are always
// possible.  Use these statistics as descriptive summaries, not
// as evidence of causal relationships.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

/** Arithmetic mean of an array of numbers. */
export function mean(xs: number[]): number {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Population standard deviation. */
export function stdDev(xs: number[]): number {
  const m = mean(xs);
  const ss = xs.reduce((sum, x) => sum + (x - m) ** 2, 0);
  return Math.sqrt(ss / xs.length);
}

/**
 * Return an array of ranks (1-based, average ties) for `xs`.
 */
export function rankList(xs: number[]): number[] {
  const n = xs.length;
  const indexed = xs.map((x, i) => ({ value: x, index: i }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    // Find the end of the tie group.
    while (j < n && indexed[j].value === indexed[i].value) {
      j++;
    }
    // Average rank for this group (1-based): avg of (i+1)..(j)
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].index] = avgRank;
    }
    i = j;
  }
  return ranks;
}

/**
 * Pearson product-moment correlation coefficient.
 *
 * WARNING: measures linear association only — not causation.
 */
export function pearsonR(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) {
    throw new Error("xs and ys must have the same length.");
  }
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  const sx = stdDev(xs);
  const sy = stdDev(ys);

  if (sx === 0 || sy === 0) return 0; // constant variable → no correlation

  const covariance = xs.reduce(
    (sum, x, i) => sum + (x - mx) * (ys[i] - my),
    0,
  );
  return covariance / (n * sx * sy);
}

/**
 * Spearman rank-order correlation coefficient.
 * Converts xs and ys to ranks then computes Pearson-r on those ranks.
 *
 * WARNING: measures monotonic association only — not causation.
 */
export function spearmanRho(xs: number[], ys: number[]): number {
  return pearsonR(rankList(xs), rankList(ys));
}

/**
 * Given a record mapping variable names to value arrays, return a matrix
 * of pairwise Pearson-r values as an array of { a, b, r } objects.
 */
export function correlationMatrix(
  data: Record<string, number[]>,
): { a: string; b: string; r: number }[] {
  const names = Object.keys(data);
  const results: { a: string; b: string; r: number }[] = [];
  for (const a of names) {
    for (const b of names) {
      results.push({ a, b, r: pearsonR(data[a], data[b]) });
    }
  }
  return results;
}
