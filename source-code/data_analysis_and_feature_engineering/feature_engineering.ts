// feature_engineering.ts - Feature engineering and impact measurement

import { readFileSync } from "node:fs";

type Matrix = number[][];
type Vector = number[];

function loadCSV(path: string): { headers: string[]; data: Matrix } {
  const content = readFileSync(path, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const data = lines.slice(1).map(line => line.split(",").map(Number));
  return { headers, data };
}

function fitScaler(data: Matrix): { means: Vector; stds: Vector } {
  const n = data.length, d = data[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);
  for (const row of data) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n;
  for (const row of data) for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n);
  return { means, stds };
}

function applyScaler(data: Matrix, s: { means: Vector; stds: Vector }): Matrix {
  return data.map(row => row.map((v, j) => s.stds[j] > 0 ? (v - s.means[j]) / s.stds[j] : 0));
}

function transpose(m: Matrix): Matrix { return m[0].map((_, i) => m.map(r => r[i])); }

function matMul(a: Matrix, b: Matrix): Matrix {
  const R = a.length, C = b[0].length, K = b.length;
  const r: Matrix = Array.from({ length: R }, () => new Array(C).fill(0));
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) for (let k = 0; k < K; k++) r[i][j] += a[i][k] * b[k][j];
  return r;
}

function invertMatrix(m: Matrix): Matrix {
  const n = m.length;
  const aug: Matrix = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let i = 0; i < n; i++) {
    let mx = i; for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[mx][i])) mx = k;
    [aug[i], aug[mx]] = [aug[mx], aug[i]];
    const p = aug[i][i]; if (Math.abs(p) < 1e-12) throw new Error("Singular");
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= p;
    for (let k = 0; k < n; k++) { if (k !== i) { const f = aug[k][i]; for (let j = 0; j < 2 * n; j++) aug[k][j] -= f * aug[i][j]; } }
  }
  return aug.map(r => r.slice(n));
}

function linearRegressionR2(xTrain: Matrix, yTrain: Vector, xTest: Matrix, yTest: Vector): number {
  const Xb = xTrain.map(r => [1, ...r]);
  const Xt = transpose(Xb);
  const w = matMul(invertMatrix(matMul(Xt, Xb)), matMul(Xt, yTrain.map(v => [v]))).map(r => r[0]);
  const yPred = xTest.map(r => { let s = w[0]; for (let j = 0; j < r.length; j++) s += w[j + 1] * r[j]; return s; });
  const mean = yTest.reduce((a, b) => a + b, 0) / yTest.length;
  const ssRes = yTest.reduce((s, a, i) => s + (a - yPred[i]) ** 2, 0);
  const ssTot = yTest.reduce((s, a) => s + (a - mean) ** 2, 0);
  return 1 - ssRes / ssTot;
}

// ---- Main ----
const { headers, data } = loadCSV("../regression_and_clustering/housing.csv");
const targetIdx = headers.indexOf("MedHouseVal");
const featureHeaders = headers.filter((_, i) => i !== targetIdx);
const X = data.map(row => row.filter((_, i) => i !== targetIdx));
const y = data.map(row => row[targetIdx]);
const splitIdx = Math.floor(X.length * 0.8);

// Original features
const scaler1 = fitScaler(X.slice(0, splitIdx));
const r2Original = linearRegressionR2(
  applyScaler(X.slice(0, splitIdx), scaler1), y.slice(0, splitIdx),
  applyScaler(X.slice(splitIdx), scaler1), y.slice(splitIdx)
);

// Engineered features
const roomsIdx = featureHeaders.indexOf("AveRooms");
const bedrmIdx = featureHeaders.indexOf("AveBedrms");
const occupIdx = featureHeaders.indexOf("AveOccup");
const ageIdx = featureHeaders.indexOf("HouseAge");
const popIdx = featureHeaders.indexOf("Population");

const XEng = X.map(row => [
  ...row,
  row[roomsIdx] / (row[occupIdx] || 1),
  row[bedrmIdx] / (row[roomsIdx] || 1),
  row[popIdx] / (row[ageIdx] || 1),
]);

const scaler2 = fitScaler(XEng.slice(0, splitIdx));
const r2Engineered = linearRegressionR2(
  applyScaler(XEng.slice(0, splitIdx), scaler2), y.slice(0, splitIdx),
  applyScaler(XEng.slice(splitIdx), scaler2), y.slice(splitIdx)
);

console.log("=== Model Comparison: Original vs. Engineered Features ===");
console.log(`  Original (${X[0].length} features)           R² = ${r2Original.toFixed(4)}`);
console.log(`  Engineered (${XEng[0].length} features)        R² = ${r2Engineered.toFixed(4)}`);
const improvement = ((r2Engineered - r2Original) / Math.abs(r2Original) * 100).toFixed(1);
console.log(`  Improvement: ${improvement}%`);
