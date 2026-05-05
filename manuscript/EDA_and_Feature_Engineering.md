# Exploratory Data Analysis and Feature Engineering

Before training any machine learning model, you need to understand your data. **Exploratory Data Analysis (EDA)** is the process of examining a dataset to summarize its main characteristics, find patterns, detect anomalies, and check assumptions. **Feature engineering** is the art of creating new input variables — or transforming existing ones — to improve model performance.

These steps often make the difference between a mediocre model and a good one. As the saying goes: "garbage in, garbage out."

No external libraries are required for this chapter — we work with TypeScript arrays and our own utility functions.

The examples for this chapter are in the directory **source-code/data_analysis_and_feature_engineering**.

{width: "80%"}
![Architecture diagram for EDA and feature engineering pipeline](FIG_data_analysis_and_feature_engineering.jpg)

We continue using the California Housing dataset from the previous chapter.

## Exploratory Data Analysis

### Loading and Inspecting the Data

The first thing to do with any dataset is to understand its shape, types, and basic statistics:

```typescript
import { readFileSync } from "node:fs";

function loadCSV(path: string): { headers: string[]; data: number[][] } {
  const content = readFileSync(path, "utf-8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const data = lines.slice(1).map(line => line.split(",").map(Number));
  return { headers, data };
}

const { headers, data } = loadCSV("housing.csv");
console.log(`=== Dataset Overview ===`);
console.log(`Shape: ${data.length} rows × ${headers.length} columns\n`);
console.log("Columns:");
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
function columnStats(data: number[][], colIdx: number): {
  count: number; mean: number; std: number; min: number; max: number;
} {
  const col = data.map(row => row[colIdx]);
  const count = col.length;
  const mean = col.reduce((a, b) => a + b, 0) / count;
  const std = Math.sqrt(
    col.reduce((sum, x) => sum + (x - mean) ** 2, 0) / count
  );
  return { count, mean, std, min: Math.min(...col), max: Math.max(...col) };
}

console.log("\n=== Summary Statistics ===");
headers.forEach((name, i) => {
  const s = columnStats(data, i);
  console.log(
    `  ${name.padEnd(15)} mean=${s.mean.toFixed(2).padStart(8)} ` +
    `std=${s.std.toFixed(2).padStart(8)} ` +
    `min=${s.min.toFixed(2).padStart(8)} ` +
    `max=${s.max.toFixed(2).padStart(8)}`
  );
});
```

Notice the wide range differences: **Population** ranges from 3 to 35,682 while **AveBedrms** ranges from 0.33 to 34.07. This tells us we will need feature scaling before training most models.

### Correlation Analysis

Understanding which features correlate with the target helps guide feature selection and engineering:

```typescript
function correlation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

const targetIdx = headers.indexOf("MedHouseVal");
const target = data.map(row => row[targetIdx]);

console.log("\n=== Correlation with MedHouseVal ===");
const correlations = headers
  .map((name, i) => ({ name, corr: i !== targetIdx ? correlation(
    data.map(row => row[i]), target) : 0 }))
  .filter(c => c.name !== "MedHouseVal")
  .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));

correlations.forEach(({ name, corr }) => {
  console.log(`  ${name.padEnd(22)} ${corr >= 0 ? "+" : ""}${corr.toFixed(4)}`);
});
```

**MedInc** (median income) stands out with a correlation of +0.69 — by far the strongest predictor. This aligns with what we saw from the regression coefficients in the previous chapter.

### Outlier Detection

The IQR (Interquartile Range) method flags values that fall more than 1.5 × IQR below Q1 or above Q3:

```typescript
function countOutliers(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return values.filter(v => v < lower || v > upper).length;
}

console.log("\n=== Outlier Counts (IQR method) ===");
headers.forEach((name, i) => {
  const col = data.map(row => row[i]);
  const outliers = countOutliers(col);
  const pct = ((outliers / data.length) * 100).toFixed(1);
  console.log(`  ${name.padEnd(22)} ${outliers} outliers (${pct}%)`);
});
```


## Feature Engineering

Feature engineering is where domain knowledge meets data science. By creating new features that better represent the underlying patterns, we can significantly improve model performance — sometimes more than choosing a fancier algorithm.

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

Our engineered features improved R² from 0.58 to 0.66 — a **15% improvement** in explained variance, using the exact same algorithm. This demonstrates why feature engineering is often more valuable than model selection for improving results.


## EDA and Feature Engineering Wrap-up

In this chapter we covered the essential data preparation skills that precede model training:

- **EDA** helps you understand your data through summary statistics, correlation analysis, and outlier detection. Never skip this step.
- **Feature engineering** transforms raw data into more informative inputs: creating derived features, encoding categories, handling missing values, and scaling.
- The payoff is real: our engineered features produced a 15% improvement in model performance with zero algorithm changes.

These techniques apply to every machine learning project, whether you are using classic algorithms or deep learning frameworks. In the next part of this book, we move into deep learning.

