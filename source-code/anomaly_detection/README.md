# Anomaly Detection — Example for Mark Watson's book "Practical Artificial Intelligence with TypeScript"

Book URI: https://leanpub.com/TypeScriptAI

Gaussian-based anomaly detection implemented from scratch in TypeScript — no external dependencies.

## Overview

This library implements a statistical anomaly detector that:

1. Fits per-feature Gaussian distributions (mean + variance) to training data
2. Tunes an epsilon threshold via cross-validation to minimise classification errors
3. Flags data points whose average Gaussian PDF probability falls below the threshold

The example uses the **Wisconsin Diagnostic Breast Cancer** dataset (647 examples, 9 features + 1 target label).

## Setup

```bash
npm install
```

## Run

```bash
npx tsx wisconsin_demo.ts
```

## Book Cover Material, Copyright, and License

This example is released using the Apache 2 license.

Copyright 2022-2026 Mark Watson. All rights reserved.

## This Book is Licensed with Creative Commons Attribution CC BY Version 3
