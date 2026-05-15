// clustering.ts - K-Means clustering on Iris dataset

import { readFileSync } from "node:fs";

function kMeans(data: number[][], k: number, maxIter = 100) {
  const n = data.length, d = data[0].length;
  const idx = new Set<number>();
  while (idx.size < k) idx.add(Math.floor(Math.random() * n));
  let centroids = [...idx].map(i => [...data[i]]);
  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const newLabels = data.map(p => {
      let minD = Infinity, best = 0;
      for (let c = 0; c < k; c++) {
        const dist = p.reduce((s, v, j) => s + (v - centroids[c][j]) ** 2, 0);
        if (dist < minD) { minD = dist; best = c; }
      }
      return best;
    });
    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;
    centroids = Array.from({ length: k }, (_, c) => {
      const members = data.filter((_, i) => labels[i] === c);
      return members.length ? Array.from({ length: d }, (_, j) => members.reduce((s, p) => s + p[j], 0) / members.length) : centroids[c];
    });
  }
  return { labels, centroids };
}

function silhouetteScore(data: number[][], labels: number[]): number {
  const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, d) => s + (v - b[d]) ** 2, 0));
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const same = data.filter((_, j) => j !== i && labels[j] === labels[i]);
    const a = same.length > 0 ? same.reduce((s, p) => s + dist(data[i], p), 0) / same.length : 0;
    const others = new Set(labels.filter(l => l !== labels[i]));
    let b = Infinity;
    for (const c of others) {
      const m = data.filter((_, j) => labels[j] === c);
      b = Math.min(b, m.reduce((s, p) => s + dist(data[i], p), 0) / m.length);
    }
    if (b === Infinity) b = 0;
    total += b > a ? (b - a) / b : a > b ? (b - a) / a : 0;
  }
  return total / data.length;
}

// ---- Main ----
const lines = readFileSync("iris.csv", "utf-8").trim().split("\n");
const featureNames = lines[0].split(",").slice(0, 4);
const rows = lines.slice(1).map(l => l.split(","));
const data = rows.map(r => r.slice(0, 4).map(Number));
const speciesLabels = rows.map(r => r[4]);
const uniqueSpecies = [...new Set(speciesLabels)];

console.log(`Dataset: ${data.length} samples, ${data[0].length} features`);
console.log(`Features: ${JSON.stringify(featureNames)}  Species: ${JSON.stringify(uniqueSpecies)}`);

console.log("\n=== Silhouette Scores ===");
for (let k = 2; k <= 6; k++) console.log(`  k=${k}: ${silhouetteScore(data, kMeans(data, k).labels).toFixed(4)}`);

console.log("\n=== K-Means k=3 ===");
const { labels, centroids } = kMeans(data, 3);

console.log(`\nCluster vs. Species:\n${"".padEnd(12)} ${uniqueSpecies.map(s => s.padEnd(12)).join("")}`);
for (let c = 0; c < 3; c++) {
  const counts = uniqueSpecies.map(sp => labels.filter((l, i) => l === c && speciesLabels[i] === sp).length);
  console.log(`  Cluster ${c}  ${counts.map(n => String(n).padEnd(12)).join("")}`);
}

console.log("\nCentroids:");
featureNames.forEach((name, j) => console.log(`  ${name.padEnd(16)} ${centroids.map(c => c[j].toFixed(2).padStart(6)).join("  ")}`));
