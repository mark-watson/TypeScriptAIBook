// regression.ts - Linear Regression on housing data via Normal Equation

import { readFileSync } from "node:fs";

type Matrix = number[][]; type Vector = number[];

const transpose = (m: Matrix): Matrix => m[0].map((_, i) => m.map(r => r[i]));

function matMul(a: Matrix, b: Matrix): Matrix {
  const [R, C, K] = [a.length, b[0].length, b.length];
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
    const p = aug[i][i]; if (Math.abs(p) < 1e-12) throw new Error("Singular matrix");
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= p;
    for (let k = 0; k < n; k++) if (k !== i) { const f = aug[k][i]; for (let j = 0; j < 2 * n; j++) aug[k][j] -= f * aug[i][j]; }
  }
  return aug.map(r => r.slice(n));
}

function fitScaler(data: Matrix) {
  const n = data.length, d = data[0].length;
  const means = new Array(d).fill(0), stds = new Array(d).fill(0);
  for (const r of data) for (let j = 0; j < d; j++) means[j] += r[j];
  for (let j = 0; j < d; j++) means[j] /= n;
  for (const r of data) for (let j = 0; j < d; j++) stds[j] += (r[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n);
  return { means, stds };
}

const applyScaler = (data: Matrix, s: { means: Vector; stds: Vector }): Matrix =>
  data.map(r => r.map((v, j) => s.stds[j] > 0 ? (v - s.means[j]) / s.stds[j] : 0));

function linearRegression(X: Matrix, y: Vector): Vector {
  const Xb = X.map(r => [1, ...r]), Xt = transpose(Xb);
  return matMul(invertMatrix(matMul(Xt, Xb)), matMul(Xt, y.map(v => [v]))).map(r => r[0]);
}

const predict = (X: Matrix, w: Vector): Vector =>
  X.map(r => r.reduce((s, v, j) => s + w[j + 1] * v, w[0]));

const mae = (a: Vector, p: Vector) => a.reduce((s, v, i) => s + Math.abs(v - p[i]), 0) / a.length;
const rmse = (a: Vector, p: Vector) => Math.sqrt(a.reduce((s, v, i) => s + (v - p[i]) ** 2, 0) / a.length);
function r2Score(a: Vector, p: Vector) {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return 1 - a.reduce((s, v, i) => s + (v - p[i]) ** 2, 0) / a.reduce((s, v) => s + (v - m) ** 2, 0);
}

// ---- Main ----
const content = readFileSync("housing.csv", "utf-8");
const lines = content.trim().split("\n");
const featureNames = lines[0].split(",").slice(0, -1);
const data = lines.slice(1).map(l => l.split(",").map(Number));
const X = data.map(r => r.slice(0, -1)), y = data.map(r => r[r.length - 1]);

const si = Math.floor(X.length * 0.8);
const scaler = fitScaler(X.slice(0, si));
const weights = linearRegression(applyScaler(X.slice(0, si), scaler), y.slice(0, si));
const yPred = predict(applyScaler(X.slice(si), scaler), weights);
const yTest = y.slice(si);

console.log(`Dataset: (${X.length}, ${X[0].length + 1})  Target: ${Math.min(...y).toFixed(2)} – ${Math.max(...y).toFixed(2)}`);
console.log(`\n=== Linear Regression Results ===`);
console.log(`  MAE: ${mae(yTest, yPred).toFixed(4)}  RMSE: ${rmse(yTest, yPred).toFixed(4)}  R²: ${r2Score(yTest, yPred).toFixed(4)}`);
console.log(`\nFeature coefficients (scaled):`);
featureNames.forEach((name, i) => {
  const c = weights[i + 1];
  console.log(`  ${name.padEnd(20)} ${c >= 0 ? "+" : ""}${c.toFixed(4)}`);
});
