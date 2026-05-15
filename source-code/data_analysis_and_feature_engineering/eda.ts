// eda.ts - Exploratory Data Analysis

import { readFileSync } from "node:fs";

function loadCSV(path: string) {
  const lines = readFileSync(path, "utf-8").trim().split("\n");
  return { headers: lines[0].split(",").map(h => h.trim()), data: lines.slice(1).map(l => l.split(",").map(Number)) };
}

function columnStats(data: number[][], i: number) {
  const col = data.map(r => r[i]), n = col.length;
  const mean = col.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(col.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { n, mean, std, min: Math.min(...col), max: Math.max(...col) };
}

function correlation(x: number[], y: number[]): number {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

function countOutliers(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
}

const { headers, data } = loadCSV("../regression_and_clustering/housing.csv");
console.log(`=== Dataset Overview ===\nShape: ${data.length} rows × ${headers.length} columns\n\nColumns:`);
headers.forEach(h => console.log(`  ${h}`));

console.log("\n=== Summary Statistics ===");
headers.forEach((name, i) => {
  const s = columnStats(data, i);
  console.log(`  ${name.padEnd(15)} mean=${s.mean.toFixed(2).padStart(8)} std=${s.std.toFixed(2).padStart(8)} min=${s.min.toFixed(2).padStart(8)} max=${s.max.toFixed(2).padStart(8)}`);
});

const targetIdx = headers.indexOf("MedHouseVal");
const target = data.map(r => r[targetIdx]);

console.log("\n=== Correlation with MedHouseVal ===");
headers.map((name, i) => ({ name, corr: i !== targetIdx ? correlation(data.map(r => r[i]), target) : 0 }))
  .filter(c => c.name !== "MedHouseVal")
  .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
  .forEach(({ name, corr }) => console.log(`  ${name.padEnd(22)} ${corr >= 0 ? "+" : ""}${corr.toFixed(4)}`));

console.log("\n=== Outlier Counts (IQR method) ===");
headers.forEach((name, i) => {
  const out = countOutliers(data.map(r => r[i]));
  console.log(`  ${name.padEnd(22)} ${out} outliers (${((out / data.length) * 100).toFixed(1)}%)`);
});
