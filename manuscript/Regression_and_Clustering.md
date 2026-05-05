# Regression and Clustering

In the previous chapter we implemented a K-Nearest Neighbors classifier from scratch in TypeScript. Here we expand our coverage of "classic" machine learning with two more fundamental techniques: **regression** for predicting continuous values, and **clustering** for discovering groups in data without labeled targets.

No external libraries are required for this chapter — we implement everything from scratch in TypeScript.

The examples for this chapter are in the directory **source-code/regression_and_clustering**.

{width: "80%"}
![Architecture diagram for linear regression and K-Means clustering pipelines](FIG_regression_and_clustering.jpg)

## Regression: Predicting Housing Prices

Regression is a type of supervised machine learning where the goal is to predict a continuous numerical value rather than a class label. While classification asks "which category?", regression asks "how much?" or "how many?"

Common regression algorithms include:

- **Linear Regression**: models the relationship between features and target as a straight line (or hyperplane in multiple dimensions).
- **Polynomial Regression**: extends linear regression by adding polynomial terms, allowing the model to capture non-linear relationships.
- **Ridge and Lasso Regression**: variants of linear regression that add regularization to prevent overfitting.

We will use a housing dataset (a subset of the California Housing dataset exported as CSV) with features describing census block groups (median income, average number of rooms, location, etc.), with the target being the median house value.

### Linear Regression

Our first example fits a linear regression model using the normal equation — a closed-form solution that computes the optimal weights directly:

```typescript
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
  // Gauss-Jordan elimination for matrix inversion
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
// w = (X^T X)^{-1} X^T y
function linearRegression(X: Matrix, y: Vector): Vector {
  // Add bias column of 1s
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

// Train/test split (80/20)
const splitIdx = Math.floor(X.length * 0.8);
const xTrain = X.slice(0, splitIdx);
const xTest = X.slice(splitIdx);
const yTrain = y.slice(0, splitIdx);
const yTest = y.slice(splitIdx);

// Scale features
const scaler = fitScaler(xTrain);
const xTrainScaled = applyScaler(xTrain, scaler);
const xTestScaled = applyScaler(xTest, scaler);

// Train
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
```

Because we scaled the features, the coefficients tell us the relative importance of each feature. **MedInc** (median income) typically has the largest positive coefficient, confirming that income is the strongest predictor of housing prices. The geographic features (**Latitude** and **Longitude**) are also very influential — location matters!

To evaluate a regression model, we use different metrics than classification:

- **MAE (Mean Absolute Error)**: average magnitude of prediction errors in the same units as the target.
- **RMSE (Root Mean Squared Error)**: like MAE but penalizes larger errors more heavily.
- **R² (R-squared)**: the proportion of variance in the target explained by the model (1.0 = perfect, 0.0 = no better than predicting the mean).


## Clustering: Discovering Groups in Data

Clustering is an **unsupervised** learning technique — unlike classification and regression, we do not provide labeled targets. Instead, the algorithm discovers natural groupings in the data.

K-Means is the most widely used clustering algorithm. It works by:

1. Choosing K initial cluster centers (centroids).
2. Assigning each data point to the nearest centroid.
3. Recomputing each centroid as the mean of its assigned points.
4. Repeating steps 2-3 until convergence.

We will use the classic **Iris dataset** (150 samples, 4 features measuring sepal and petal dimensions, with 3 known species). This lets us evaluate how well K-Means recovers the true species groupings.

### K-Means Implementation

```typescript
import { readFileSync } from "node:fs";

function kMeans(
  data: number[][],
  k: number,
  maxIter: number = 100
): { labels: number[]; centroids: number[][] } {
  const n = data.length;
  const d = data[0].length;

  // Initialize centroids randomly from data points
  const indices = new Set<number>();
  while (indices.size < k) {
    indices.add(Math.floor(Math.random() * n));
  }
  let centroids = [...indices].map(i => [...data[i]]);
  let labels = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign each point to nearest centroid
    const newLabels = data.map(point => {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < k; c++) {
        const dist = point.reduce(
          (sum, val, j) => sum + (val - centroids[c][j]) ** 2, 0
        );
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      return bestCluster;
    });

    // Check for convergence
    if (newLabels.every((l, i) => l === labels[i])) break;
    labels = newLabels;

    // Recompute centroids
    centroids = Array.from({ length: k }, (_, c) => {
      const members = data.filter((_, i) => labels[i] === c);
      if (members.length === 0) return centroids[c];
      return Array.from({ length: d }, (_, j) =>
        members.reduce((sum, point) => sum + point[j], 0) / members.length
      );
    });
  }

  return { labels, centroids };
}

function silhouetteScore(data: number[][], labels: number[]): number {
  const n = data.length;
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const clusterI = labels[i];
    const sameCluster = data.filter((_, j) => j !== i && labels[j] === clusterI);
    const a = sameCluster.length > 0
      ? sameCluster.reduce((sum, p) =>
          sum + Math.sqrt(p.reduce((s, v, d) =>
            s + (v - data[i][d]) ** 2, 0)), 0) / sameCluster.length
      : 0;

    const otherClusters = new Set(labels.filter(l => l !== clusterI));
    let b = Infinity;
    for (const c of otherClusters) {
      const members = data.filter((_, j) => labels[j] === c);
      const avgDist = members.reduce((sum, p) =>
        sum + Math.sqrt(p.reduce((s, v, d) =>
          s + (v - data[i][d]) ** 2, 0)), 0) / members.length;
      b = Math.min(b, avgDist);
    }

    totalScore += (b - a) / Math.max(a, b);
  }

  return totalScore / n;
}
```

### Running the Clustering Example

```bash
$ tsx clustering.ts
Dataset: 150 samples, 4 features
Features: ['sepal length', 'sepal width', 'petal length', 'petal width']
Known species: ['setosa', 'versicolor', 'virginica']

=== Silhouette Scores for Different k Values ===
  k=2: silhouette score = 0.5818
  k=3: silhouette score = 0.4599
  k=4: silhouette score = 0.3869
  k=5: silhouette score = 0.3459
  k=6: silhouette score = 0.3171
```

The silhouette score is highest at k=2, which suggests that the data most naturally splits into two groups. This makes biological sense: setosa is very distinct from the other two species, while versicolor and virginica overlap considerably.


## Regression and Clustering Wrap-up

In this chapter we covered two fundamental machine learning techniques beyond classification:

- **Regression** lets us predict continuous values. We saw that even simple linear regression can be informative, and that feature coefficients reveal which inputs drive predictions.
- **Clustering** discovers structure in unlabeled data. We used silhouette scores to evaluate cluster quality and cross-tabulations to compare clusters against known labels.

Together with the classification example in the previous chapter, you now have hands-on experience with the three core tasks of classic machine learning — all implemented from scratch in TypeScript. In the next chapter we will explore the data preparation work that comes *before* training any model.

