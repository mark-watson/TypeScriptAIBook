/**
 * classification.ts
 *
 * K-Nearest Neighbors (KNN) classifier for the Wisconsin Breast Cancer dataset.
 *
 * Workflow:
 *   1. Load and split training / test data from CSV.
 *   2. Compute z-score normalization parameters (mean, std) from the training set.
 *   3. Standardize both train and test feature matrices.
 *   4. Predict each test sample's label by majority vote of its k nearest neighbors.
 *   5. Print a scikit-learn-style classification report with per-class precision, recall,
 *      F1-score, support, overall accuracy, and the confusion matrix.
 *
 * Usage:  node classification.ts [k]
 *   Default k = 5 (number of neighbors).
 */

import { loadData } from "./loadData.js";

/**
 * Compute per-feature mean and standard deviation (population variance) across all rows.
 * Returns an object containing the `means` and `stds` arrays — essentially a "fitted" scaler.
 * Two-pass algorithm: first pass accumulates sums for means, second pass accumulates
 * squared deviations to compute std. This avoids numerical instability from computing
 * variance in a single pass on floating-point data.
 */
function fitScaler(data: number[][]) {
  const n = data.length, d = data[0].length;
  const means = new Array(d).fill(0), stds = new Array(d).fill(0);

  // ---- Pass 1: compute column-wise means ----
  for (const row of data) {
    for (let j = 0; j < d; j++) {
      means[j] += row[j];
    }
  }
  for (let j = 0; j < d; j++) {
    means[j] /= n;
  }

  // ---- Pass 2: compute column-wise (population) standard deviations ----
  for (const row of data) {
    for (let j = 0; j < d; j++) {
      stds[j] += (row[j] - means[j]) ** 2;
    }
  }
  for (let j = 0; j < d; j++) {
    stds[j] = Math.sqrt(stds[j] / n);
  }

  return { means, stds };
}

/**
 * Apply a pre-fitted scaler to center each feature by its mean and scale by its standard deviation.
 * Handles the edge case where std === 0 (constant feature) by producing 0 for every element.
 */
const applyScaler = (data: number[][], s: { means: number[]; stds: number[] }) =>
  data.map(r =>
    r.map((v, j) => (s.stds[j] > 0 ? (v - s.means[j]) / s.stds[j] : 0))
  );

/**
 * Euclidean distance between two vectors.
 */
const eucDist = (a: number[], b: number[]) =>
  Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

/**
 * Predict a single sample's label using K-Nearest Neighbors with a max-heap.
 *
 * Time complexity: O(n log k) instead of O(n log n) for a full sort.
 * The heap has a hard cap of size `k`. Once full, we only replace the root (smallest distance)
 * if the new sample's distance is tighter — i.e., keep the k smallest in the heap at every step.
 */
function knnPredict(
  trainX: number[][],
  trainY: number[],
  sample: number[],
  k: number,
): number {
  // Max-heap storing {distance, label} pairs; root is always the LARGEST distance (worst candidate).
  const heap: { d: number; l: number }[] = [];

  for (let i = 0; i < trainX.length; i++) {
    const d = eucDist(sample, trainX[i]);

    if (heap.length < k) {
      // Still building up to capacity — just insert.
      heap.push({ d, l: trainY[i] });
      if (heap.length === k) {
        // First time full: sort descending so root is largest.
        heap.sort((a, b) => b.d - a.d);
      }
    } else if (d < heap[0].d) {
      // New sample is closer than the worst in the heap — replace root and sift down.
      heap[0] = { d, l: trainY[i] };

      // Max-heap "sift down" / "bubble" from root to restore invariant.
      for (let j = 0; ; ) {
        const left = 2 * j + 1;
        const right = 2 * j + 2;
        let largest = j;

        if (left < heap.length && heap[left].d > heap[largest].d) {
          largest = left;
        }
        if (right < heap.length && heap[right].d > heap[largest].d) {
          largest = right;
        }
        if (largest === j) break; // Heap property restored.

        [heap[j], heap[largest]] = [heap[largest], heap[j]];
        j = largest;
      }
    }
  }

  // Majority vote over the k nearest neighbors.
  const votes: Record<number, number> = {};
  for (const { l } of heap) {
    votes[l] = (votes[l] || 0) + 1;
  }

  // Return the label with the highest vote count.
  return Number(Object.entries(votes).sort(([, a], [, b]) => b - a)[0][0]);
}

/** Per-class classification metrics stored for report output. */
interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

/**
 * Compute per-class evaluation metrics (precision, recall, F1, support) plus overall accuracy
 * and the confusion matrix based on actual vs. predicted labels.
 *
 * - precision = TP / (TP + FP)  — of all predicted positives, how many were correct?
 * - recall    = TP / (TP + FN)  — of all actual positives, how many were found?
 * - f1        = 2 * (precision * recall) / (precision + recall)  — harmonic mean.
 * - support   — count of actual samples belonging to this class.
 *
 * Returns a structured result containing:
 *   - `report`: per-class metrics keyed by label.
 *   - `accuracy`: proportion of correct predictions across all samples.
 *   - `confusionMatrix[nb][nc]`: number of samples with actual label n predicted as nc.
 */
function computeMetrics(
  actual: number[],
  predicted: number[],
): {
  report: Record<number, ClassMetrics>;
  accuracy: number;
  confusionMatrix: number[][];
} {
  // Unique class labels sorted ascending (e.g., [0, 1] for binary classification).
  const classes = [...new Set(actual)].sort((a, b) => a - b);
  const n = actual.length;

  // Build the confusion matrix by iterating over all predictions.
  const cm: number[][] = classes.map(() => classes.map(() => 0));
  for (let i = 0; i < n; i++) {
    cm[actual[i]][predicted[i]]++;
  }

  // Per-class metric computation from confusion matrix entries.
  const report: Record<number, ClassMetrics> = {};
  for (const cls of classes) {
    const tp = cm[cls][cls];                          // True positives
    const fp = classes.reduce((s, c) => s + (c !== cls ? cm[c][cls] : 0), 0);   // False positives
    const fn = classes.reduce((s, c) => s + (c !== cls ? cm[cls][c] : 0), 0);   // False negatives
    const sup = actual.filter(a => a === cls).length; // Support

    const pr = tp + fp > 0 ? tp / (tp + fp) : 0;  // Precision
    const re = tp + fn > 0 ? tp / (tp + fn) : 0;  // Recall
    const f1 = pr + re > 0 ? (2 * pr * re) / (pr + re) : 0; // F1

    report[cls] = { precision: pr, recall: re, f1, support: sup };
  }

  const correct = actual.filter((a, i) => a === predicted[i]).length;
  return { report, accuracy: correct / n, confusionMatrix: cm };
}

/**
 * Print a human-readable classification report in the style of scikit-learn.
 * Shows per-class precision, recall, F1-score, support on separate lines followed by
 * overall accuracy and the confusion matrix.
 */
function formatReport(actual: number[], predicted: number[]): string {
  const { report, accuracy, confusionMatrix } = computeMetrics(actual, predicted);
  const classes = Object.keys(report).map(Number).sort((a, b) => a - b);
  const lines: string[] = [];

  lines.push("              precision    recall  f1-score   support");
  for (const cls of classes) {
    const m = report[cls];
    lines.push(
      `    ${cls}            ${m.precision.toFixed(2)}       ${m.recall.toFixed(2)}       ${m.f1.toFixed(2)}          ${m.support}`,
    );
  }
  lines.push(`    accuracy                            ${accuracy.toFixed(2)}         ${actual.length}`);
  lines.push("");
  lines.push("Confusion Matrix:");
  lines.push(confusionMatrix.map(r => r.join("   ")).join("\n"));

  return lines.join("\n");
}

/** Entry point — run the full KNN pipeline. */
function main(): void {
  try {
    // Load and split data.
    const { xTrain, yTrain, xTest, yTest } = loadData();

    // Fit scaler on training data only (prevents data leakage from test → train).
    const scaler = fitScaler(xTrain);
    const xTrainS = applyScaler(xTrain, scaler);
    const xTestS  = applyScaler(xTest, scaler);

    // Read k from CLI args; default to 5.
    const k = process.argv[2] ? parseInt(process.argv[2], 10) : 5;
    console.log(`Running KNN with k=${k}...\n`);

    // Predict labels for each test sample and print a summary report.
    const yPred = xTestS.map(s => knnPredict(xTrainS, yTrain, s, k));
    console.log(formatReport(yTest, yPred));
  } catch (err) {
    console.error("Classification failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
