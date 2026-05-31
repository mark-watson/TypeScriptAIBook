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

/** Partial sort via max-heap: O(n log k) instead of O(n log n). */
function knnPredict(trainX: number[][], trainY: number[], sample: number[], k: number): number {
  const heap: { d: number; l: number }[] = [];
  for (let i = 0; i < trainX.length; i++) {
    const d = eucDist(sample, trainX[i]);
    if (heap.length < k) {
      heap.push({ d, l: trainY[i] });
      if (heap.length === k) heap.sort((a, b) => b.d - a.d);
    } else if (d < heap[0].d) {
      heap[0] = { d, l: trainY[i] };
      for (let j = 0; ; ) {
        const left = 2 * j + 1, right = 2 * j + 2;
        let largest = j;
        if (left < heap.length && heap[left].d > heap[largest].d) largest = left;
        if (right < heap.length && heap[right].d > heap[largest].d) largest = right;
        if (largest === j) break;
        [heap[j], heap[largest]] = [heap[largest], heap[j]];
        j = largest;
      }
    }
  }
  const votes: Record<number, number> = {};
  for (const { l } of heap) votes[l] = (votes[l] || 0) + 1;
  return Number(Object.entries(votes).sort(([, a], [, b]) => b - a)[0][0]);
}

interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

function computeMetrics(actual: number[], predicted: number[]): {
  report: Record<number, ClassMetrics>;
  accuracy: number;
  confusionMatrix: number[][];
} {
  const classes = [...new Set(actual)].sort((a, b) => a - b);
  const n = actual.length;
  const cm: number[][] = classes.map(() => classes.map(() => 0));
  for (let i = 0; i < n; i++) cm[actual[i]][predicted[i]]++;

  const report: Record<number, ClassMetrics> = {};
  for (const cls of classes) {
    const tp = cm[cls][cls];
    const fp = classes.reduce((s, c) => s + (c !== cls ? cm[c][cls] : 0), 0);
    const fn = classes.reduce((s, c) => s + (c !== cls ? cm[cls][c] : 0), 0);
    const sup = actual.filter(a => a === cls).length;
    const pr = tp + fp > 0 ? tp / (tp + fp) : 0;
    const re = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = pr + re > 0 ? (2 * pr * re) / (pr + re) : 0;
    report[cls] = { precision: pr, recall: re, f1, support: sup };
  }
  const correct = actual.filter((a, i) => a === predicted[i]).length;
  return { report, accuracy: correct / n, confusionMatrix: cm };
}

function formatReport(actual: number[], predicted: number[]): string {
  const { report, accuracy, confusionMatrix } = computeMetrics(actual, predicted);
  const classes = Object.keys(report).map(Number).sort((a, b) => a - b);
  const lines: string[] = [];
  lines.push("              precision    recall  f1-score   support");
  for (const cls of classes) {
    const m = report[cls];
    lines.push(`   ${cls}           ${m.precision.toFixed(2)}      ${m.recall.toFixed(2)}      ${m.f1.toFixed(2)}         ${m.support}`);
  }
  lines.push(`    accuracy                           ${accuracy.toFixed(2)}        ${actual.length}`);
  lines.push("");
  lines.push("Confusion Matrix:");
  lines.push(confusionMatrix.map(r => r.join("  ")).join("\n"));
  return lines.join("\n");
}

function main() {
  try {
    const { xTrain, yTrain, xTest, yTest } = loadData();
    const scaler = fitScaler(xTrain);
    const xTrainS = applyScaler(xTrain, scaler);
    const xTestS = applyScaler(xTest, scaler);
    const k = process.argv[2] ? parseInt(process.argv[2], 10) : 5;
    console.log(`Running KNN with k=${k}...\n`);
    const yPred = xTestS.map(s => knnPredict(xTrainS, yTrain, s, k));
    console.log(formatReport(yTest, yPred));
  } catch (err) {
    console.error("Classification failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
