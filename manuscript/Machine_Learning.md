# "Classic" Machine Learning

"Classic" Machine Learning (ML) is a broad field that encompasses a variety of algorithms and techniques for learning from data. These techniques are used to make predictions, classify data, and uncover patterns and insights. Some of the most common types of classic ML algorithms include:

- Linear regression: a method for modeling the relationship between a dependent variable and one or more independent variables by fitting a linear equation to the observed data.
- Logistic regression: a method for modeling the relationship between a binary dependent variable and one or more independent variables by fitting a logistic function to the observed data.
- Decision Trees: a method for modeling decision rules based on the values of the input variables, which are organized in a tree-like structure.
- Random Forest: a method that creates multiple decision trees and averages the results to improve the overall performance of the model
- K-Nearest Neighbors (K-NN): a method for classifying data by finding the K-nearest examples in the training data and assigning the most similar common class among them.
- Naive Bayes: a method for classifying data based on Bayes' theorem and the assumption of independence between the input variables.

We will be covering a very small subset of "classic" ML, and then dive deeper into Deep Learning in later chapters. Deep Learning differs from classic ML in several ways:

- Scale: Classic ML algorithms are typically designed to work with small to medium-sized datasets, while deep learning algorithms are designed to work with large-scale datasets, such as millions or billions of examples.
- Architecture: Classic ML algorithms have a relatively shallow architecture, with a small number of layers and parameters, while deep learning algorithms have a deep architecture, with many layers and millions or billions of parameters.
- Non-linearity: Classic ML algorithms are sometimes linear, (i.e., the relationship between the input and output is modeled by a linear equation), while deep learning algorithms are non-linear, (i.e., the relationship is modeled by a non-linear function).
- Feature extraction: "Classic" ML requires feature extraction, which is the process of transforming the raw input data into a set of features that can be used by the algorithm. Deep learning can automatically learn features from raw data, so it does not usually require too much separate effort for feature extraction.

So, Deep Learning is a subfield of machine learning that is focused on the design and implementation of artificial neural networks with many layers which are capable of learning from large-scale and complex data. It is characterized by its deep architecture, non-linearity, and ability to learn features from raw data, which sets it apart from "classic" machine learning algorithms.

## Example Material

Here we cover a single example of what I think of as "classic machine learning" — a K-Nearest Neighbors classifier implemented from scratch in TypeScript. Later we cover deep learning in three separate chapters. Deep learning models are more general and powerful but it is important to recognize the types of problems that can be solved using the simpler techniques.

The only requirements for this chapter are Node.js and TypeScript — no external libraries needed. We implement KNN from scratch to demonstrate both the algorithm and TypeScript's suitability for numerical computing.

The examples for this chapter are in the directory **source-code/machine-learning**.

{width: "80%"}
![Architecture diagram for KNN classification pipeline with feature scaling and evaluation](FIG_machine-learning.jpg)

Please note that the content in this book is heavily influenced by what I use in my own work. I mostly use deep learning so its coverage comprises half this book. For this classic machine learning chapter I only use a classification model. I will not be covering regression or clustering models.

We will use the same Wisconsin cancer dataset for both the following classification example and a deep learning classification example in a later chapter. Here are the first few rows of the file **labeled_cancer_data.csv**:

{width: "94%"}
![](wisconsindata-1.png)

The last column **class** indicates the class of the sample, 0 for non-malignant and 1 for malignant.

## Loading CSV Data

First, we need a utility to load our CSV data files. Unlike Python's Pandas, we write a small CSV parser directly:

Listing of **loadData.ts**:

```typescript
import { readFileSync } from "node:fs";

export interface DataSet {
  xTrain: number[][];
  yTrain: number[];
  xTest: number[][];
  yTest: number[];
}

export function loadData(): DataSet {
  const parseCSV = (path: string): number[][] => {
    const content = readFileSync(path, "utf-8");
    return content
      .trim()
      .split("\n")
      .slice(1) // skip header
      .map(line => line.split(",").map(Number));
  };

  const train = parseCSV("labeled_cancer_data.csv");
  const test = parseCSV("labeled_test_data.csv");

  const xTrain = train.map(row => row.slice(0, 9));
  const yTrain = train.map(row => row[row.length - 1]);

  const xTest = test.map(row => row.slice(0, 9));
  const yTest = test.map(row => row[row.length - 1]);

  console.log("Number training examples:", xTrain.length);
  console.log("Number testing examples:", xTest.length);

  return { xTrain, yTrain, xTest, yTest };
}
```

We read the CSV file, skip the header row, and split each line by commas. In TypeScript we work with arrays of numbers directly rather than using a DataFrame abstraction.

## Classification Using K-Nearest Neighbors

Classification is a type of supervised machine learning problem where the goal is to predict the class or category of an input sample based on a set of features. The goal of a classification model is to learn a mapping from the input features to the output class labels.

We implement the KNN algorithm from scratch. The key operations are: scale the features, compute Euclidean distances, find the K nearest neighbors, and take a majority vote.

```typescript
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

function classificationReport(
  actual: number[],
  predicted: number[]
): void {
  const classes = [0, 1];
  console.log(
    "              precision    recall  f1-score   support"
  );
  for (const cls of classes) {
    const tp = actual.filter((a, i) => a === cls && predicted[i] === cls).length;
    const fp = actual.filter((a, i) => a !== cls && predicted[i] === cls).length;
    const fn = actual.filter((a, i) => a === cls && predicted[i] !== cls).length;
    const support = actual.filter(a => a === cls).length;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0
      ? (2 * precision * recall) / (precision + recall) : 0;
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
```

Note that we fit the scaler on the training data and then use the same fitted scaler to transform the test data. This is important: scaling the test data with parameters learned from the training set prevents data leakage and ensures a fair evaluation.

We can now train and test the model and evaluate how accurate the model is. In reading the following output, you should understand a few definitions. In machine learning, precision, recall, F1-score, and support are all metrics used to evaluate the performance of a classification model, specifically in regards to binary classification:

- Precision: the proportion of true positive predictions out of the total of all positive predictions made by the model. It is a measure of how many of the positive predictions were actually correct.
- Recall: the proportion of true positive predictions out of all actual positive observations in the data. It is a measure of how well the model is able to find all the positive observations.
- F1-score: the harmonic mean of precision and recall. It is a measure of the balance between precision and recall and is generally used when you want to seek a balance between precision and recall.
- Support: number of observations in each class.

These metrics provide an overall view of a model's performance in terms of both correctly identifying positive observations and avoiding false positive predictions.


```bash
$ tsx classification.ts
Number training examples: 554
Number testing examples: 15

Confusion Matrix:
8  1
0  6

Classification Report:
              precision    recall  f1-score   support
         0.0       1.00      0.89      0.94         9
         1.0       0.86      1.00      0.92         6
    accuracy                           0.93        15
```


## Classic Machine Learning Wrap-up

I have already admitted my personal biases in favor of deep learning over simpler machine learning and I proved that by implementing a single KNN classifier from scratch in this chapter. The advantage of TypeScript here is that the implementation is clear, type-safe, and requires zero external dependencies. In the next chapters we will use more sophisticated approaches.

