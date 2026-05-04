// regression.ts - Linear Regression on housing data via Normal Equation

import { readFileSync } from "node:fs";

// ---- Matrix utilities ----
type Matrix = number[][];
type Vector = number[];

function transpose(m: Matrix): Matrix {
  return m[0].map((_, i) => m.map(row => row[i]));
}

function matMul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length, cols = b[0].length, inner = b.length;
  const result: Matrix = Array.from({ length: rows },
    () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        result[i][j] += a[i][k] * b[k][j];
  return result;
}

function invertMatrix(m: Matrix): Matrix {
  const n = m.length;
  const aug: Matrix = m.map((row, i) => [
    ...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  ]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++)
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    const pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-12) throw new Error("Singular matrix");
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
  }
  return aug.map(row => row.slice(n));
}

// ---- Data loading ----
function loadHousingData(path: string): {
  X: Matrix; y: Vector; featureNames: string[]
} {
  const content = readFileSync(path, "utf-8");
  const lines = content.trim().split("\n");
  const featureNames = lines[0].split(",").slice(0, -1);
  const data = lines.slice(1).map(line => line.split(",").map(Number));
  const X = data.map(row => row.slice(0, -1));
  const y = data.map(row => row[row.length - 1]);
  return { X, y, featureNames };
}

// ---- Feature scaling ----
function fitScaler(data: Matrix): { means: Vector; stds: Vector } {
  const n = data.length, d = data[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);
  for (const row of data)
    for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n;
  for (const row of data)
    for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n);
  return { means, stds };
}

function applyScaler(data: Matrix, s: { means: Vector; stds: Vector }): Matrix {
  return data.map(row =>
    row.map((val, j) => s.stds[j] > 0 ? (val - s.means[j]) / s.stds[j] : 0)
  );
}

// ---- Linear Regression via Normal Equation ----
function linearRegression(X: Matrix, y: Vector): Vector {
  const Xb: Matrix = X.map(row => [1, ...row]);
  const Xt = transpose(Xb);
  const XtX = matMul(Xt, Xb);
  const XtXinv = invertMatrix(XtX);
  const Xty = matMul(Xt, y.map(v => [v]));
  const w = matMul(XtXinv, Xty);
  return w.map(row => row[0]);
}

function predict(X: Matrix, weights: Vector): Vector {
  return X.map(row => {
    let sum = weights[0]; // bias
    for (let j = 0; j < row.length; j++) sum += weights[j + 1] * row[j];
    return sum;
  });
}

// ---- Evaluation metrics ----
function mae(actual: Vector, predicted: Vector): number {
  return actual.reduce((sum, a, i) =>
    sum + Math.abs(a - predicted[i]), 0) / actual.length;
}

function rmse(actual: Vector, predicted: Vector): number {
  const mse = actual.reduce((sum, a, i) =>
    sum + (a - predicted[i]) ** 2, 0) / actual.length;
  return Math.sqrt(mse);
}

function r2Score(actual: Vector, predicted: Vector): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssRes = actual.reduce((sum, a, i) =>
    sum + (a - predicted[i]) ** 2, 0);
  const ssTot = actual.reduce((sum, a) =>
    sum + (a - mean) ** 2, 0);
  return 1 - ssRes / ssTot;
}

// ---- Main ----
const { X, y, featureNames } = loadHousingData("housing.csv");

const splitIdx = Math.floor(X.length * 0.8);
const xTrain = X.slice(0, splitIdx);
const xTest = X.slice(splitIdx);
const yTrain = y.slice(0, splitIdx);
const yTest = y.slice(splitIdx);

const scaler = fitScaler(xTrain);
const xTrainScaled = applyScaler(xTrain, scaler);
const xTestScaled = applyScaler(xTest, scaler);

const weights = linearRegression(xTrainScaled, yTrain);
const yPred = predict(xTestScaled, weights);

console.log(`Dataset shape: (${X.length}, ${X[0].length + 1})`);
console.log(`Target range: ${Math.min(...y).toFixed(2)} - ${Math.max(...y).toFixed(2)}`);
console.log(`\n=== Linear Regression Results ===`);
console.log(`  MAE:  ${mae(yTest, yPred).toFixed(4)}`);
console.log(`  RMSE: ${rmse(yTest, yPred).toFixed(4)}`);
console.log(`  R²:   ${r2Score(yTest, yPred).toFixed(4)}`);
console.log(`\nFeature coefficients (scaled):`);
featureNames.forEach((name, i) => {
  const coeff = weights[i + 1];
  console.log(`  ${name.padEnd(20)} ${coeff >= 0 ? "+" : ""}${coeff.toFixed(4)}`);
});
