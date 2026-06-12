import "./polyfill.js";
import * as tf from "@tensorflow/tfjs-node";
import { readFileSync } from "node:fs";

function loadData() {
  const parse = (p: string) => readFileSync(p, "utf-8").trim().split("\n").slice(1).map(l => l.split(",").map(Number));
  const train = parse("../machine-learning/labeled_cancer_data.csv");
  const test = parse("../machine-learning/labeled_test_data.csv");
  const [xTrain, yTrain] = [train.map(r => r.slice(0, 9)), train.map(r => [r[r.length - 1]])];
  const [xTest, yTest] = [test.map(r => r.slice(0, 9)), test.map(r => [r[r.length - 1]])];

  const xT = tf.tensor2d(xTrain);
  const mean = xT.mean(0), std = xT.sub(mean).square().mean(0).sqrt().add(tf.scalar(1e-8));
  return {
    xTrain: xT.sub(mean).div(std), yTrain: tf.tensor2d(yTrain),
    xTest: tf.tensor2d(xTest).sub(mean).div(std), yTest: tf.tensor2d(yTest),
    numTrain: xTrain.length, numTest: xTest.length, yTestRaw: yTest.map(r => r[0]),
  };
}

function buildModel() {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [9], units: 15, activation: "relu" }));
  model.add(tf.layers.dense({ units: 15, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  model.compile({ optimizer: tf.train.sgd(0.01), loss: "binaryCrossentropy", metrics: ["accuracy"] });
  return model;
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

const { xTrain, yTrain, xTest, numTrain, numTest, yTestRaw } = loadData();
console.log(`Training: ${numTrain}  Test: ${numTest}`);
console.log("\nModel: Dense(9→15,ReLU) → Dense(15→15,ReLU) → Dropout(0.2) → Dense(1,Sigmoid)");

const model = buildModel();
console.log("\nTraining:");
await model.fit(xTrain, yTrain, {
  epochs: 60, batchSize: 32, verbose: 0,
  callbacks: { onEpochEnd: (ep, logs) => { if ((ep + 1) % 10 === 0) console.log(`  Epoch ${String(ep + 1).padStart(3)}/60  loss: ${logs?.loss?.toFixed(4)}`); } },
});

const yPred = Array.from(await (model.predict(xTest) as tf.Tensor).data()).map(v => v >= 0.5 ? 1 : 0);
const cm = [[0, 0], [0, 0]];
yTestRaw.forEach((a, i) => cm[a][yPred[i]]++);

console.log(`\nConfusion Matrix:\n[[${cm[0][0]}, ${cm[0][1]}],\n [${cm[1][0]}, ${cm[1][1]}]]`);
console.log("\nClassification Report:");
classReport(yTestRaw, yPred);
