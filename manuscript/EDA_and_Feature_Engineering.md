# Exploratory Data Analysis and Feature Engineering

Before training any machine learning model, you need to understand your data. **Exploratory Data Analysis (EDA)** is the process of examining a dataset to summarize its main characteristics, find patterns, detect anomalies, and check assumptions. **Feature engineering** is the art of creating new input variables, or transforming existing ones, to improve model performance.

These steps often make the difference between a mediocre model and a good one. As the saying goes: "garbage in, garbage out."

No external libraries are required for this chapter, we work with TypeScript arrays and our own utility functions.

The examples for this chapter are in the directory **source-code/data_analysis_and_feature_engineering**.

{width: "80%"}
![Architecture diagram for EDA and feature engineering pipeline](FIG_data_analysis_and_feature_engineering.jpg)

We continue using the California Housing dataset from a previous chapter.

## Exploratory Data Analysis

### Loading and Inspecting the Data

The first thing to do with any dataset is to understand its shape, types, and basic statistics:

```typescript
import { readFileSync } from "node:fs";

function loadCSV(path: string) {
  const lines = readFileSync(path, "utf-8").trim().split("\n");
  return { headers: lines[0].split(",").map(h => h.trim()), data: lines.slice(1).map(l => l.split(",").map(Number)) };
}

const { headers, data } = loadCSV("housing.csv");
console.log(`=== Dataset Overview ===\nShape: ${data.length} rows × ${headers.length} columns\n\nColumns:`);
headers.forEach(h => console.log(`  ${h}`));
```

Running our **eda.ts** script gives us:

```bash
$ tsx eda.ts
=== Dataset Overview ===
Shape: 20640 rows × 9 columns

Columns:
  MedInc
  HouseAge
  AveRooms
  AveBedrms
  Population
  AveOccup
  Latitude
  Longitude
  MedHouseVal
```

### Summary Statistics

```typescript
function columnStats(data: number[][], i: number) {
  const col = data.map(r => r[i]), n = col.length;
  const mean = col.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(col.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  return { n, mean, std, min: Math.min(...col), max: Math.max(...col) };
}

console.log("\n=== Summary Statistics ===");
headers.forEach((name, i) => {
  const s = columnStats(data, i);
  console.log(`  ${name.padEnd(15)} mean=${s.mean.toFixed(2).padStart(8)} std=${s.std.toFixed(2).padStart(8)} min=${s.min.toFixed(2).padStart(8)} max=${s.max.toFixed(2).padStart(8)}`);
});
```

Notice the wide range differences: **Population** ranges from 3 to 35,682 while **AveBedrms** ranges from 0.33 to 34.07. This tells us we will need feature scaling before training most models.

### Correlation Analysis

Understanding which features correlate with the target helps guide feature selection and engineering:

```typescript
function correlation(x: number[], y: number[]): number {
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

const targetIdx = headers.indexOf("MedHouseVal");
const target = data.map(r => r[targetIdx]);

console.log("\n=== Correlation with MedHouseVal ===");
headers.map((name, i) => ({ name, corr: i !== targetIdx ? correlation(data.map(r => r[i]), target) : 0 }))
  .filter(c => c.name !== "MedHouseVal")
  .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
  .forEach(({ name, corr }) => console.log(`  ${name.padEnd(22)} ${corr >= 0 ? "+" : ""}${corr.toFixed(4)}`));
```

**MedInc** (median income) stands out with a correlation of +0.69, by far the strongest predictor. This aligns with what we saw from the regression coefficients in the previous chapter.

### Outlier Detection

The IQR (Interquartile Range) method flags values that fall more than 1.5 × IQR below Q1 or above Q3:

```typescript
function countOutliers(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
}

console.log("\n=== Outlier Counts (IQR method) ===");
headers.forEach((name, i) => {
  const out = countOutliers(data.map(r => r[i]));
  console.log(`  ${name.padEnd(22)} ${out} outliers (${((out / data.length) * 100).toFixed(1)}%)`);
});
```


## Feature Engineering

Feature engineering is where domain knowledge meets data science. By creating new features that better represent the underlying patterns, we can significantly improve model performance, sometimes more than choosing a fancier algorithm.

### Creating New Features

We can derive meaningful features by combining existing ones:

```typescript
// Indices for the features we need
const roomsIdx = headers.indexOf("AveRooms");
const bedrmIdx = headers.indexOf("AveBedrms");
const occupIdx = headers.indexOf("AveOccup");
const ageIdx = headers.indexOf("HouseAge");
const popIdx = headers.indexOf("Population");

const engineered = data.map(row => [
  ...row.slice(0, -1),  // original features (excluding target)
  row[roomsIdx] / (row[occupIdx] || 1),    // RoomsPerHousehold
  row[bedrmIdx] / (row[roomsIdx] || 1),    // BedroomRatio
  row[popIdx] / (row[ageIdx] || 1),         // PopPerHousehold
]);
```

- **RoomsPerHousehold**: a proxy for house size relative to occupancy.
- **BedroomRatio**: what fraction of rooms are bedrooms (a measure of house layout).
- **PopPerHousehold**: population growth rate proxy (newer areas with high population).

### Handling Missing Data

Real datasets almost always have missing values. Common strategies include:

- **Drop rows**: simple but loses data.
- **Fill with mean/median**: preserves dataset size; median is more robust to outliers.
- **Fill with a model prediction**: more sophisticated but adds complexity.

```typescript
function fillMissing(values: number[]): number[] {
  const valid = values.filter(v => !isNaN(v));
  const sorted = [...valid].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return values.map(v => isNaN(v) ? median : v);
}
```

### Measuring the Impact

The ultimate test of feature engineering is whether it improves model performance. We compare a Linear Regression model with the original 8 features against one with our 11 engineered features:

```bash
=== Model Comparison: Original vs. Engineered Features ===
  Original (8 features)           R² = 0.5758
  Engineered (11 features)        R² = 0.6622
```

Our engineered features improved R² from 0.58 to 0.66, a **15% improvement** in explained variance, using the exact same algorithm. This demonstrates why feature engineering is often more valuable than model selection for improving results.


## EDA and Feature Engineering Wrap-up

In this chapter we covered the essential data preparation skills that precede model training:

- **EDA** helps you understand your data through summary statistics, correlation analysis, and outlier detection. Never skip this step.
- **Feature engineering** transforms raw data into more informative inputs: creating derived features, encoding categories, handling missing values, and scaling.
- The payoff is real: our engineered features produced a 15% improvement in model performance with zero algorithm changes.

These techniques apply to every machine learning project, whether you are using classic algorithms or deep learning frameworks. In the next part of this book, we move into deep learning.

## Optional Practice Problems

1. **Z-Score Outlier Detection**
   The Exploratory Data Analysis script ([eda.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/data_analysis_and_feature_engineering/eda.ts)) uses the Interquartile Range (IQR) method to count outliers. Write an alternative function, `countOutliersZScore(values: number[], threshold = 3.0): number`, that flags values as outliers if their absolute Z-score is greater than the specified threshold:
   $$z = \frac{x - \mu}{\sigma}$$
   Compare the outlier counts and percentages between the IQR method and the Z-score method (with a threshold of 3.0) for the `Population` and `AveOccup` columns.

2. **Outlier Filtering and Imputation**
   Instead of just identifying outliers, we often need to handle them before model training. Extend [eda.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/data_analysis_and_feature_engineering/eda.ts) to implement two handling strategies:
   - **Trimming (Removal)**: Write a function that filters out any rows where the target value (`MedHouseVal`) is an outlier according to the IQR method.
   - **Winsorization (Capping)**: Write a function that replaces outlier values with the nearest non-outlier boundary (i.e., values below $Q1 - 1.5 \times IQR$ are set to $Q1 - 1.5 \times IQR$, and values above $Q3 + 1.5 \times IQR$ are set to $Q3 + 1.5 \times IQR$).
   Evaluate how each strategy impacts the correlation of features with `MedHouseVal`.

3. **Min-Max Scaling**
   The feature engineering script ([feature_engineering.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/data_analysis_and_feature_engineering/feature_engineering.ts)) implements standard scaling (Z-score normalization). Write a Min-Max scaler utility:
   ```typescript
   function fitMinMax(data: Matrix) { /* ... */ }
   function applyMinMax(data: Matrix, scaler: { mins: Vector, maxs: Vector }): Matrix { /* ... */ }
   ```
   This scaler should map all features to the range $[0, 1]$ using the formula:
   $$x_{\text{scaled}} = \frac{x - x_{\text{min}}}{x_{\text{max}} - x_{\text{min}}}$$
   Retrain the linear regression model using Min-Max scaling on the original features. Does it achieve the same $R^2$ score as standard scaling? Why or why not?

4. **Logarithmic Feature Transformation**
   Features like `Population` and `AveOccup` are highly right-skewed. Apply a log transform $x \to \ln(x + 1)$ to these two columns. 
   - Compute the correlation of the log-transformed `Population` with `MedHouseVal` and compare it to the correlation of the original feature.
   - Add these log-transformed columns to your feature matrix, train the linear regression model, and measure the impact on the $R^2$ score.
