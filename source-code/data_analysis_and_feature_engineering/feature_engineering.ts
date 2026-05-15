// feature_engineering.ts - Feature engineering and impact measurement

import { readFileSync } from "node:fs";

type Matrix = number[][]; type Vector = number[];

function loadCSV(path: string) {
  const lines = readFileSync(path, "utf-8").trim().split("\n");
  return { headers: lines[0].split(",").map(h => h.trim()), data: lines.slice(1).map(l => l.split(",").map(Number)) };
}

function fitScaler(data: Matrix) {
  const n = data.length, d = data[0].length;
  const means = new Array(d).fill(0), stds = new Array(d).fill(0);
  for (const row of data) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n;
  for (const row of data) for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n);
  return { means, stds };
}

const applyScaler = (data: Matrix, s: { means: Vector; stds: Vector }): Matrix =>
  data.map(r => r.map((v, j) => s.stds[j] > 0 ? (v - s.means[j]) / s.stds[j] : 0));

const transpose = (m: Matrix): Matrix => m[0].map((_, i) => m.map(r => r[i]));

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
    for (let k = 0; k < n; k++) if (k !== i) { const f = aug[k][i]; for (let j = 0; j < 2 * n; j++) aug[k][j] -= f * aug[i][j]; }
  }
  return aug.map(r => r.slice(n));
}

function linearRegressionR2(xTrain: Matrix, yTrain: Vector, xTest: Matrix, yTest: Vector): number {
  const Xb = xTrain.map(r => [1, ...r]), Xt = transpose(Xb);
  const w = matMul(invertMatrix(matMul(Xt, Xb)), matMul(Xt, yTrain.map(v => [v]))).map(r => r[0]);
  const yPred = xTest.map(r => r.reduce((s, v, j) => s + w[j + 1] * v, w[0]));
  const mean = yTest.reduce((a, b) => a + b, 0) / yTest.length;
  return 1 - yTest.reduce((s, a, i) => s + (a - yPred[i]) ** 2, 0) / yTest.reduce((s, a) => s + (a - mean) ** 2, 0);
}

// ---- Main ----
const { headers, data } = loadCSV("../regression_and_clustering/housing.csv");
const targetIdx = headers.indexOf("MedHouseVal");
const featureHeaders = headers.filter((_, i) => i !== targetIdx);
const X = data.map(r => r.filter((_, i) => i !== targetIdx));
const y = data.map(r => r[targetIdx]);
const si = Math.floor(X.length * 0.8);

const s1 = fitScaler(X.slice(0, si));
const r2Orig = linearRegressionR2(applyScaler(X.slice(0, si), s1), y.slice(0, si), applyScaler(X.slice(si), s1), y.slice(si));

const [ri, bi, oi, ai, pi] = ["AveRooms", "AveBedrms", "AveOccup", "HouseAge", "Population"].map(n => featureHeaders.indexOf(n));
const XEng = X.map(r => [...r, r[ri] / (r[oi] || 1), r[bi] / (r[ri] || 1), r[pi] / (r[ai] || 1)]);
const s2 = fitScaler(XEng.slice(0, si));
const r2Eng = linearRegressionR2(applyScaler(XEng.slice(0, si), s2), y.slice(0, si), applyScaler(XEng.slice(si), s2), y.slice(si));

console.log("=== Model Comparison: Original vs. Engineered Features ===");
console.log(`  Original (${X[0].length} features)           R² = ${r2Orig.toFixed(4)}`);
console.log(`  Engineered (${XEng[0].length} features)        R² = ${r2Eng.toFixed(4)}`);
console.log(`  Improvement: ${((r2Eng - r2Orig) / Math.abs(r2Orig) * 100).toFixed(1)}%`);
