// clustering.ts - K-Means clustering on Iris dataset

import { readFileSync } from "node:fs";

function kMeans(
  data: number[][],
  k: number,
  maxIter: number = 100
): { labels: number[]; centroids: number[][] } {
  const n = data.length;
  const d = data[0].length;

  // Initialize centroids randomly from data points
  const indices = new Set<number>();
  while (indices.size < k) {
    indices.add(Math.floor(Math.random() * n));
  }
  let centroids = [...indices].map(i => [...data[i]]);
  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    const newLabels = data.map(point => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        const dist = point.reduce(
          (sum, val, j) => sum + (val - centroids[c][j]) ** 2, 0
        );
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;

    centroids = Array.from({ length: k }, (_, c) => {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length === 0) return centroids[c];
      return Array.from({ length: d }, (_, j) =>
        members.reduce((sum, point) => sum + point[j], 0) / members.length
      );
    });
  }

  return { labels, centroids };
}

function silhouetteScore(data: number[][], labels: number[]): number {
  const n = data.length;
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const clusterI = labels[i];
    const sameCluster = data.filter((_, j) => j !== i && labels[j] === clusterI);
    const a = sameCluster.length > 0
      ? sameCluster.reduce((sum, p) =>
          sum + Math.sqrt(p.reduce((s, v, d) =>
            s + (v - data[i][d]) ** 2, 0)), 0) / sameCluster.length
      : 0;

    const otherClusters = new Set(labels.filter(l => l !== clusterI));
    let b = Infinity;
    for (const c of otherClusters) {
      const members = data.filter((_, j) => labels[j] === c);
      const avgDist = members.reduce((sum, p) =>
        sum + Math.sqrt(p.reduce((s, v, d) =>
          s + (v - data[i][d]) ** 2, 0)), 0) / members.length;
      b = Math.min(b, avgDist);
    }

    if (b === Infinity) b = 0;
    totalScore += b > a ? (b - a) / b : a > b ? (b - a) / a : 0;
  }

  return totalScore / n;
}

// ---- Main ----
// Load Iris dataset
const content = readFileSync("iris.csv", "utf-8");
const lines = content.trim().split("\n");
const headers = lines[0].split(",");
const featureNames = headers.slice(0, 4);
const rows = lines.slice(1).map(line => line.split(","));
const data = rows.map(row => row.slice(0, 4).map(Number));
const speciesLabels = rows.map(row => row[4]);
const uniqueSpecies = [...new Set(speciesLabels)];

console.log(`Dataset: ${data.length} samples, ${data[0].length} features`);
console.log(`Features: ${JSON.stringify(featureNames)}`);
console.log(`Known species: ${JSON.stringify(uniqueSpecies)}`);

console.log("\n=== Silhouette Scores for Different k Values ===");
for (let k = 2; k <= 6; k++) {
  const { labels } = kMeans(data, k);
  const score = silhouetteScore(data, labels);
  console.log(`  k=${k}: silhouette score = ${score.toFixed(4)}`);
}

// Run with k=3 and compare to true labels
console.log("\n=== K-Means with k=3 (matching species count) ===");
const { labels, centroids } = kMeans(data, 3);

// Cross-tabulation
console.log("\nCluster vs. Species cross-tabulation:");
console.log(`${"".padEnd(12)} ${uniqueSpecies.map(s => s.padEnd(12)).join("")}`);
for (let c = 0; c < 3; c++) {
  const counts = uniqueSpecies.map(sp =>
    labels.filter((l, i) => l === c && speciesLabels[i] === sp).length
  );
  console.log(`  Cluster ${c}  ${counts.map(n => String(n).padEnd(12)).join("")}`);
}

console.log("\nCentroids:");
featureNames.forEach((name, j) => {
  const vals = centroids.map(c => c[j].toFixed(2).padStart(6));
  console.log(`  ${name.padEnd(16)} ${vals.join("  ")}`);
});
