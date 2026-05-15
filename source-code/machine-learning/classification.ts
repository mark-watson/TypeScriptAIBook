// classification.ts - KNN classifier for Wisconsin cancer dataset

import { loadData } from "./loadData.js";

function fitScaler(data: number[][]) {
  const n = data.length, d = data[0].length;
  const means = new Array(d).fill(0), stds = new Array(d).fill(0);
  for (const row of data) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n;
  for (const row of data) for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n);
  return { means, stds };
}

const applyScaler = (data: number[][], s: { means: number[]; stds: number[] }) =>
  data.map(r => r.map((v, j) => s.stds[j] > 0 ? (v - s.means[j]) / s.stds[j] : 0));

const eucDist = (a: number[], b: number[]) =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

function knnPredict(trainX: number[][], trainY: number[], sample: number[], k: number): number {
  const nearest = trainX.map((p, i) => ({ d: eucDist(sample, p), l: trainY[i] }))
    .sort((a, b) => a.d - b.d).slice(0, k);
  const votes: Record<number, number> = {};
  for (const { l } of nearest) votes[l] = (votes[l] || 0) + 1;
  return Number(Object.entries(votes).sort(([, a], [, b]) => b - a)[0][0]);
}

function classReport(actual: number[], predicted: number[]) {
  console.log("              precision    recall  f1-score   support");
  for (const cls of [0, 1]) {
    const tp = actual.filter((a, i) => a === cls && predicted[i] === cls).length;
    const fp = actual.filter((a, i) => a !== cls && predicted[i] === cls).length;
    const fn = actual.filter((a, i) => a === cls && predicted[i] !== cls).length;
    const sup = actual.filter(a => a === cls).length;
    const pr = tp + fp > 0 ? tp / (tp + fp) : 0, re = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = pr + re > 0 ? (2 * pr * re) / (pr + re) : 0;
    console.log(`         ${cls.toFixed(1)}       ${pr.toFixed(2)}      ${re.toFixed(2)}      ${f1.toFixed(2)}         ${sup}`);
  }
  console.log(`    accuracy                           ${(actual.filter((a, i) => a === predicted[i]).length / actual.length).toFixed(2)}        ${actual.length}`);
}

const { xTrain, yTrain, xTest, yTest } = loadData();
const scaler = fitScaler(xTrain);
const xTrainS = applyScaler(xTrain, scaler), xTestS = applyScaler(xTest, scaler);
const yPred = xTestS.map(s => knnPredict(xTrainS, yTrain, s, 5));

const cm = [[0, 0], [0, 0]];
yTest.forEach((a, i) => cm[a][yPred[i]]++);
console.log(`\nConfusion Matrix:\n${cm.map(r => r.join("  ")).join("\n")}`);
console.log("\nClassification Report:");
classReport(yTest, yPred);
