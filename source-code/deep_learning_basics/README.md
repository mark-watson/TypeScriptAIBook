# Deep Learning Basics Examples

Simple neural network model for cancer prediction using TensorFlow.js in TypeScript.

## Data Files Used

- `../machine-learning/labeled_cancer_data.csv`
- `../machine-learning/labeled_test_data.csv`

## Architecture

![TensorFlow.js neural network for Wisconsin cancer classification with training and evaluation pipeline](FIG_deep_learning_basics.jpg)

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Rebuilding the native bindings (if required):**
   If the native TensorFlow addon is not found or fails to initialize, rebuild the C++ bindings manually for your platform:
   ```bash
   npm run install --prefix node_modules/@tensorflow/tfjs-node
   ```

3. **Node.js v26+ Compatibility:**
   If you are running Node.js version 26.0.0 or higher, the deprecated `util.isNullOrUndefined` helper has been removed from Node's core `util` module. This project includes a `polyfill.ts` file that is imported at the start of `cancer_model.ts` to restore this API dynamically and ensure compatibility.

## Running the Example

Run the cancer classification training and evaluation pipeline:

```bash
npx tsx cancer_model.ts
```
