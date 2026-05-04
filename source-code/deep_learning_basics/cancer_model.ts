// cancer_model.ts - Neural network for Wisconsin cancer classification using TensorFlow.js

import * as tf from "@tensorflow/tfjs-node";
import { readFileSync } from "node:fs";

function loadData() {
  const parseCSV = (path: string) => {
    const content = readFileSync(path, "utf-8");
    return content.trim().split("\n").slice(1)
      .map(line => line.split(",").map(Number));
  };

  const train = parseCSV("../machine-learning/labeled_cancer_data.csv");
  const test = parseCSV("../machine-learning/labeled_test_data.csv");

  const xTrain = train.map(row => row.slice(0, 9));
  const yTrain = train.map(row => [row[row.length - 1]]);
  const xTest = test.map(row => row.slice(0, 9));
  const yTest = test.map(row => [row[row.length - 1]]);

  const xTrainTensor = tf.tensor2d(xTrain);
  const mean = xTrainTensor.mean(0);
  const std = xTrainTensor.sub(mean).square().mean(0).sqrt().add(tf.scalar(1e-8));

  const xTrainScaled = xTrainTensor.sub(mean).div(std);
  const xTestScaled = tf.tensor2d(xTest).sub(mean).div(std);

  return {
    xTrain: xTrainScaled,
    yTrain: tf.tensor2d(yTrain),
    xTest: xTestScaled,
    yTest: tf.tensor2d(yTest),
    numTrain: xTrain.length,
    numTest: xTest.length,
    yTestRaw: yTest.map(r => r[0]),
  };
}

function buildModel(): tf.Sequential {
  const model = tf.sequential();

  model.add(tf.layers.dense({
    inputShape: [9],
    units: 15,
    activation: "relu",
  }));

  model.add(tf.layers.dense({
    units: 15,
    activation: "relu",
  }));

  model.add(tf.layers.dropout({ rate: 0.2 }));

  model.add(tf.layers.dense({
    units: 1,
    activation: "sigmoid",
  }));

  model.compile({
    optimizer: tf.train.sgd(0.01),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  return model;
}

async function main() {
  const { xTrain, yTrain, xTest, yTest, numTrain, numTest, yTestRaw } = loadData();

  console.log(`Training examples: ${numTrain}`);
  console.log(`Test examples:     ${numTest}`);

  console.log("\nModel Summary:");
  console.log("  Layer 1: Dense (9 → 15, ReLU)");
  console.log("  Layer 2: Dense (15 → 15, ReLU)");
  console.log("  Layer 3: Dropout (0.2)");
  console.log("  Layer 4: Dense (15 → 1, Sigmoid)");

  const model = buildModel();

  console.log("\nTraining:");
  await model.fit(xTrain, yTrain, {
    epochs: 60,
    batchSize: 32,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0) {
          console.log(
            `  Epoch ${String(epoch + 1).padStart(3)}/60` +
            `  loss: ${logs?.loss?.toFixed(4)}`
          );
        }
      },
    },
  });

  // Predict
  const predTensor = model.predict(xTest) as tf.Tensor;
  const predValues = Array.from(await predTensor.data());
  const yPred = predValues.map(v => v >= 0.5 ? 1 : 0);

  // Confusion matrix
  const cm = [[0, 0], [0, 0]];
  for (let i = 0; i < yTestRaw.length; i++) {
    cm[yTestRaw[i]][yPred[i]]++;
  }
  console.log("\nConfusion Matrix:");
  console.log(`[[${cm[0][0]}, ${cm[0][1]}],`);
  console.log(` [${cm[1][0]}, ${cm[1][1]}]]`);

  // Classification report
  console.log("\nClassification Report:");
  console.log("              precision    recall  f1-score   support");
  for (const cls of [0, 1]) {
    const tp = yTestRaw.filter((a, i) => a === cls && yPred[i] === cls).length;
    const fp = yTestRaw.filter((a, i) => a !== cls && yPred[i] === cls).length;
    const fn = yTestRaw.filter((a, i) => a === cls && yPred[i] !== cls).length;
    const support = yTestRaw.filter(a => a === cls).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    console.log(
      `         ${cls.toFixed(1)}       ${precision.toFixed(2)}      ${recall.toFixed(2)}      ${f1.toFixed(2)}         ${support}`
    );
  }
  const correct = yTestRaw.filter((a, i) => a === yPred[i]).length;
  console.log(`    accuracy                           ${(correct / yTestRaw.length).toFixed(2)}        ${yTestRaw.length}`);
}

main();
