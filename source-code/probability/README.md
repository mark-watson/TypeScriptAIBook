# Probability — Example for Mark Watson's book "Artificial Intelligence Using TypeScript"

A from-scratch probability and statistics library covering both Bayesian and Frequentist methods.

## Modules

- **bayes.ts** — Bayesian inference: model creation, Bayes' Theorem update, MAP estimation
- **correlation.ts** — Pearson-r, Spearman-ρ, covariance, correlation matrix
- **frequentist.ts** — z-tests, t-tests, chi-squared tests, Wilson confidence intervals

## Worked Examples

- **examples/medical.ts** — Bayesian medical screening + correlation analysis
- **examples/frequentist_demo.ts** — Frequentist analysis of the same scenario + side-by-side comparison

## Setup

```bash
npm install
```

## Run

```bash
npx tsx examples/medical.ts
npx tsx examples/frequentist_demo.ts
```

## API Reference

### bayes.ts

| Export                | Description |
|-----------------------|-------------|
| `makeBayesModel()`    | Create a normalised model from prior probabilities |
| `update()`            | Apply Bayes' Theorem with a likelihood function |
| `posterior()`         | Look up a single hypothesis's posterior |
| `posteriors()`        | Return the full posterior distribution |
| `maximumAPosteriori()`| Return the MAP hypothesis |

### correlation.ts

| Export               | Description |
|----------------------|-------------|
| `mean()`             | Arithmetic mean |
| `stdDev()`           | Population standard deviation |
| `covariance()`       | Population covariance |
| `rankList()`         | Rank array (1-based, average ties) |
| `pearsonR()`         | Pearson product-moment correlation |
| `spearmanRho()`      | Spearman rank-order correlation |
| `correlationMatrix()`| Pairwise Pearson-r matrix |

### frequentist.ts

| Export                          | Description |
|---------------------------------|-------------|
| `phiApprox()`                   | Standard normal CDF Φ(z) |
| `chiSquaredCdf()`               | Chi-squared CDF (Wilson–Hilferty) |
| `zScore()`                      | z-score computation |
| `zTestProportion()`             | One-sample z-test for a binomial proportion |
| `chiSquaredTest()`              | Pearson's chi-squared goodness-of-fit |
| `tTestOneSample()`              | One-sample t-test (large-sample z-approximation) |
| `zCritical()`                   | z* critical value for a confidence level |
| `confidenceIntervalProportion()`| Wilson score confidence interval |
