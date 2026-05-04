// classification.ts - KNN classifier for Wisconsin cancer dataset

import { loadData } from "./loadData.js";

// ---- Feature scaling ----

function fitScaler(data: number[][]): { means: number[]; stds: number[] } {
  const n = data.length;
  const d = data[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);

  for (const row of data) {
    for (let j = 0; j < d; j++) means[j] += row[j];
  }
  for (let j = 0; j < d; j++) means[j] /= n;

  for (const row of data) {
    for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  }
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / n);

  return { means, stds };
}

function applyScaler(
  data: number[][],
  scaler: { means: number[]; stds: number[] }
): number[][] {
  return data.map(row =>
    row.map((val, j) =>
      scaler.stds[j] > 0 ? (val - scaler.means[j]) / scaler.stds[j] : 0
    )
  );
}

// ---- KNN Classifier ----

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function knnPredict(
  trainX: number[][],
  trainY: number[],
  testSample: number[],
  k: number
): number {
  const distances = trainX.map((point, i) => ({
    distance: euclideanDistance(testSample, point),
    label: trainY[i],
  }));

  distances.sort((a, b) => a.distance - b.distance);
  const kNearest = distances.slice(0, k);

  // Majority vote
  const votes: Record<number, number> = {};
  for (const { label } of kNearest) {
    votes[label] = (votes[label] || 0) + 1;
  }

  return Number(
    Object.entries(votes).sort(([, a], [, b]) => b - a)[0][0]
  );
}

// ---- Evaluation metrics ----

function confusionMatrix(actual: number[], predicted: number[]): number[][] {
  const matrix = [[0, 0], [0, 0]];
  for (let i = 0; i < actual.length; i++) {
    matrix[actual[i]][predicted[i]]++;
  }
  return matrix;
}

function classificationReport(actual: number[], predicted: number[]): void {
  const classes = [0, 1];
  console.log("              precision    recall  f1-score   support");
  for (const cls of classes) {
    const tp = actual.filter((a, i) => a === cls && predicted[i] === cls).length;
    const fp = actual.filter((a, i) => a !== cls && predicted[i] === cls).length;
    const fn = actual.filter((a, i) => a === cls && predicted[i] !== cls).length;
    const support = actual.filter(a => a === cls).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    console.log(
      `         ${cls.toFixed(1)}       ${precision.toFixed(2)}` +
        `      ${recall.toFixed(2)}      ${f1.toFixed(2)}` +
        `         ${support}`
    );
  }
  const correct = actual.filter((a, i) => a === predicted[i]).length;
  console.log(
    `    accuracy                           ${(correct / actual.length).toFixed(2)}        ${actual.length}`
  );
}

// ---- Main ----

const { xTrain, yTrain, xTest, yTest } = loadData();

// Scale features
const scaler = fitScaler(xTrain);
const xTrainScaled = applyScaler(xTrain, scaler);
const xTestScaled = applyScaler(xTest, scaler);

// Predict using KNN with k=5
const yPredict = xTestScaled.map(sample =>
  knnPredict(xTrainScaled, yTrain, sample, 5)
);

// Print results
const cm = confusionMatrix(yTest, yPredict);
console.log("\nConfusion Matrix:");
console.log(cm.map(row => row.join("  ")).join("\n"));
console.log("\nClassification Report:");
classificationReport(yTest, yPredict);
