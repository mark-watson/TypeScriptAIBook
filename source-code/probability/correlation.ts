// correlation.ts — Correlation helpers
//
// NOTE: Correlation measures *association*, NOT causation.
// A high |r| does not imply X causes Y.
//
// Copyright 2024-2026 Mark Watson. All rights reserved.

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export const stdDev = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
};

/** Rank array (1-based, average ties). */
export function rankList(xs: number[]): number[] {
  const indexed = xs.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
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

/** Pearson product-moment correlation. WARNING: linear association only. */
export function pearsonR(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error("xs and ys must have the same length.");
  const mx = mean(xs), my = mean(ys), sx = stdDev(xs), sy = stdDev(ys);
  if (sx === 0 || sy === 0) return 0;
  return xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / (xs.length * sx * sy);
}

/** Spearman rank-order correlation. */
export const spearmanRho = (xs: number[], ys: number[]) => pearsonR(rankList(xs), rankList(ys));

/** Pairwise Pearson-r matrix as { a, b, r } objects. */
export function correlationMatrix(data: Record<string, number[]>) {
  const names = Object.keys(data);
  return names.flatMap(a => names.map(b => ({ a, b, r: pearsonR(data[a], data[b]) })));
}
