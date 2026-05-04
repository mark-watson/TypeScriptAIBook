// eda.ts - Exploratory Data Analysis

import { readFileSync } from "node:fs";

function loadCSV(path: string): { headers: string[]; data: number[][] } {
  const content = readFileSync(path, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const data = lines.slice(1).map(line => line.split(",").map(Number));
  return { headers, data };
}

function columnStats(data: number[][], colIdx: number) {
  const col = data.map(row => row[colIdx]);
  const count = col.length;
  const mean = col.reduce((a, b) => a + b, 0) / count;
  const std = Math.sqrt(col.reduce((sum, x) => sum + (x - mean) ** 2, 0) / count);
  return { count, mean, std, min: Math.min(...col), max: Math.max(...col) };
}

function correlation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

function countOutliers(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter(v => v < lower || v > upper).length;
}

// ---- Main ----
const { headers, data } = loadCSV("../regression_and_clustering/housing.csv");
console.log(`=== Dataset Overview ===`);
console.log(`Shape: ${data.length} rows × ${headers.length} columns\n`);
console.log("Columns:");
headers.forEach(h => console.log(`  ${h}`));

console.log("\n=== Summary Statistics ===");
headers.forEach((name, i) => {
  const s = columnStats(data, i);
  console.log(
    `  ${name.padEnd(15)} mean=${s.mean.toFixed(2).padStart(8)} ` +
    `std=${s.std.toFixed(2).padStart(8)} ` +
    `min=${s.min.toFixed(2).padStart(8)} ` +
    `max=${s.max.toFixed(2).padStart(8)}`
  );
});

const targetIdx = headers.indexOf("MedHouseVal");
const target = data.map(row => row[targetIdx]);

console.log("\n=== Correlation with MedHouseVal ===");
const correlations = headers
  .map((name, i) => ({
    name,
    corr: i !== targetIdx ? correlation(data.map(row => row[i]), target) : 0,
  }))
  .filter(c => c.name !== "MedHouseVal")
  .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));

correlations.forEach(({ name, corr }) => {
  console.log(`  ${name.padEnd(22)} ${corr >= 0 ? "+" : ""}${corr.toFixed(4)}`);
});

console.log("\n=== Outlier Counts (IQR method) ===");
headers.forEach((name, i) => {
  const col = data.map(row => row[i]);
  const outliers = countOutliers(col);
  const pct = ((outliers / data.length) * 100).toFixed(1);
  console.log(`  ${name.padEnd(22)} ${outliers} outliers (${pct}%)`);
});
