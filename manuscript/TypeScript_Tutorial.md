# A TypeScript Tutorial for Command-Line AI Programs

This chapter is a focused TypeScript tutorial covering the language features you will encounter throughout this book. All examples are command-line programs, no browser, DOM, or UI framework is involved. If you are already comfortable with TypeScript you can skip this chapter and use it as a later as a reference.

We assume you have a working Node.js and tsx installation as described in the previous chapter.

## Type Basics

TypeScript's core value proposition is static typing. The compiler catches type errors before your code runs.

### Primitive Types

Primitive types are the most basic building blocks of TypeScript's type system. They represent simple, single values like strings, numbers, and booleans. You can either explicitly annotate their types or let TypeScript infer them automatically based on the assigned value.

```typescript
// Explicit type annotations
const name: string = "scikit-learn";
const version: number = 1.5;
const isStable: boolean = true;

// Type inference, TypeScript figures out the type
const framework = "TensorFlow";  // inferred as string
const layers = 96;               // inferred as number
```

### Arrays and Tuples

Arrays and tuples allow you to group multiple values together. While arrays represent collections where all elements share the same type, tuples are fixed-length arrays where each index is associated with a specific, predetermined type. You can also destructure tuples to easily extract their individual elements.

```typescript
// Arrays: all elements are the same type
const scores: number[] = [0.95, 0.87, 0.92];
const labels: string[] = ["cat", "dog", "bird"];

// Tuples: fixed length, each position has a specific type
const prediction: [string, number] = ["malignant", 0.94];
const [label, confidence] = prediction;  // destructuring
```

### Union Types

When a value could be one of several types:

```typescript
function parseInput(value: string | number): number {
  if (typeof value === "string") {
    return parseFloat(value);
  }
  return value;
}

console.log(parseInput("3.14"));  // 3.14
console.log(parseInput(2.718));   // 2.718
```

## Interfaces and Type Aliases

Interfaces define the shape of objects. They are used extensively for API responses, configuration objects, and data structures.

```typescript
// Interface for a data sample
interface DataSample {
  features: number[];
  label: string;
  confidence?: number;  // optional property
}

const sample: DataSample = {
  features: [5.1, 3.5, 1.4, 0.2],
  label: "setosa",
};

// Type alias, similar to interface but also works for unions
type Prediction = {
  label: string;
  score: number;
};

type Result = Prediction | { error: string };
```

### Readonly and Utility Types

TypeScript provides utility types for common patterns:

```typescript
// Readonly prevents mutation
interface ModelConfig {
  readonly learningRate: number;
  readonly epochs: number;
  batchSize: number;
}

const config: ModelConfig = {
  learningRate: 0.01,
  epochs: 100,
  batchSize: 32,
};
// config.learningRate = 0.1;  // Error: cannot assign to readonly

// Partial makes all properties optional
function updateConfig(
  current: ModelConfig,
  updates: Partial<ModelConfig>
): ModelConfig {
  return { ...current, ...updates };
}

// Record creates an object type with specific key and value types
const metrics: Record<string, number> = {
  accuracy: 0.95,
  precision: 0.93,
  recall: 0.97,
};
```

## Functions

### Typed Parameters and Return Values

In TypeScript, you should explicitly declare the types of a function's parameters and its return value. This ensures that the function is called with the correct arguments and that the calling code correctly handles whatever value is returned, which is especially useful for mathematical and distance calculations.

```typescript
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

console.log(euclideanDistance([1, 2, 3], [4, 5, 6]));  // 5.196...
```

### Arrow Functions

Arrow functions are concise and commonly used for callbacks and short operations:

```typescript
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const relu = (x: number): number => Math.max(0, x);

// With arrays
const values = [1.5, -0.3, 2.1, -1.0];
const activated = values.map(relu);  // [1.5, 0, 2.1, 0]
```

### Generic Functions

Generics let you write functions that work with any type while preserving type safety:

```typescript
function argMax<T>(arr: T[], compareFn: (a: T, b: T) => number): number {
  let maxIdx = 0;
  for (let i = 1; i < arr.length; i++) {
    if (compareFn(arr[i], arr[maxIdx]) > 0) {
      maxIdx = i;
    }
  }
  return maxIdx;
}

const scores = [0.1, 0.7, 0.2];
const bestIdx = argMax(scores, (a, b) => a - b);
console.log(`Best class: ${bestIdx}`);  // Best class: 1
```

### Function Overloads

When a function has different behaviors based on input types:

```typescript
function normalize(data: number[]): number[];
function normalize(data: number): number;
function normalize(data: number | number[]): number | number[] {
  if (Array.isArray(data)) {
    const max = Math.max(...data);
    return data.map(x => x / max);
  }
  return data;
}
```

## Async/Await and Promises

Almost every AI API call is asynchronous. TypeScript makes async code readable with `async/await`:

```typescript
// A function that returns a Promise
async function fetchData(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

// Using the async function
async function main() {
  try {
    const data = await fetchData("https://api.example.com/data");
    console.log(data);
  } catch (error) {
    console.error("Failed to fetch:", error);
  }
}

main();
```

### Parallel Async Operations

When you need to make multiple independent API calls:

```typescript
async function fetchMultiple(urls: string[]): Promise<string[]> {
  // Promise.all runs all fetches in parallel
  const responses = await Promise.all(
    urls.map(url => fetch(url))
  );
  return Promise.all(responses.map(r => r.text()));
}
```

### Typed API Responses

When making external network requests to AI APIs, the responses returned by `fetch` are untyped by default. You can define an interface that matches the expected JSON structure and cast the resolved response promise to that interface. This enables autocomplete and compile-time checks when accessing properties like token usage and generated text.

```typescript
interface ChatResponse {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

async function chat(prompt: string): Promise<ChatResponse> {
  const response = await fetch("https://api.example.com/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  return response.json() as Promise<ChatResponse>;
}
```

## Classes

Classes in TypeScript are useful for encapsulating state and behavior, we use them for models, agents, and data structures throughout this book.

```typescript
class KNNClassifier {
  private k: number;
  private trainData: number[][] = [];
  private trainLabels: string[] = [];

  constructor(k: number = 5) {
    this.k = k;
  }

  fit(data: number[][], labels: string[]): void {
    this.trainData = data;
    this.trainLabels = labels;
  }

  predict(sample: number[]): string {
    // Calculate distances to all training samples
    const distances = this.trainData.map((point, i) => ({
      distance: this.euclidean(sample, point),
      label: this.trainLabels[i],
    }));

    // Sort by distance and take the k nearest
    distances.sort((a, b) => a.distance - b.distance);
    const kNearest = distances.slice(0, this.k);

    // Majority vote
    const votes: Record<string, number> = {};
    for (const { label } of kNearest) {
      votes[label] = (votes[label] || 0) + 1;
    }

    return Object.entries(votes)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  private euclidean(a: number[], b: number[]): number {
    return Math.sqrt(
      a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0)
    );
  }
}
```

### Abstract Classes

When you want to define a common interface that subclasses must implement:

```typescript
abstract class BaseModel {
  abstract train(data: number[][], labels: number[]): void;
  abstract predict(sample: number[]): number;

  evaluate(testData: number[][], testLabels: number[]): number {
    let correct = 0;
    for (let i = 0; i < testData.length; i++) {
      if (this.predict(testData[i]) === testLabels[i]) {
        correct++;
      }
    }
    return correct / testData.length;
  }
}
```

## Modules and Imports

TypeScript uses ES modules. Each file is a module that explicitly exports and imports values.

### Exporting

To share functions, classes, interfaces, or constants between files, you use the `export` keyword. Exported declarations can then be imported by other files in your project, promoting code reuse and logical separation.

```typescript
// mathUtils.ts
export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

export function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((val, i) => val + b[i]);
}

export const EPSILON = 1e-8;
```

### Importing

You use the `import` keyword to bring exported variables, functions, or classes from other modules into the current file. In Node.js environment projects, you must specify the file path and include the appropriate file extension.

```typescript
// main.ts
import { dotProduct, vectorAdd, EPSILON } from "./mathUtils.js";

const result = dotProduct([1, 2, 3], [4, 5, 6]);
console.log(result);  // 32
```

Note the `.js` extension in the import path, this is required when using Node.js ES modules with TypeScript's `NodeNext` module resolution.

### Default Exports

A module can also designate a single value or class as its default export. Default exports can be imported without curly braces and can be renamed arbitrarily in the importing file, which is a common pattern when exporting a primary class.

```typescript
// model.ts
export default class LinearRegression {
  // ...
}

// main.ts
import LinearRegression from "./model.js";
```

## Error Handling

TypeScript provides structured error handling that is essential when working with APIs and file I/O.

### Try/Catch with Type Narrowing

When handling errors in asynchronous code or API calls, you can throw custom error classes that contain extra context like status codes. Within a `catch` block, you use the `instanceof` operator to narrow the type of the caught error, allowing you to selectively handle specific errors (like retrying transient network issues) while rethrowing others.

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function callApi(prompt: string): Promise<string> {
  try {
    const response = await fetch("https://api.example.com/generate", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new ApiError(
        `API request failed`,
        response.status,
        response.status >= 500
      );
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    if (error instanceof ApiError && error.retryable) {
      console.log("Retrying...");
      return callApi(prompt);  // simple retry
    }
    throw error;
  }
}
```

## Working with Files

Reading and writing files is common for loading datasets and saving results:

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

// Synchronous, simple and fine for loading config/data at startup
const csvData = readFileSync("data.csv", "utf-8");
const lines = csvData.split("\n");

// Asynchronous, preferred for larger files or in async contexts
async function loadDataset(path: string): Promise<number[][]> {
  const content = await readFile(path, "utf-8");
  return content
    .trim()
    .split("\n")
    .slice(1)  // skip header
    .map(line => line.split(",").map(Number));
}

// Writing results
async function saveResults(path: string, data: object): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2));
}
```

### Parsing CSV Files

Since we frequently work with CSV data in AI projects:

```typescript
interface CSVRow {
  [key: string]: string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",");
    const row: CSVRow = {};
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim() ?? "";
    });
    return row;
  });
}
```

## Enums and Literal Types

Useful for defining fixed sets of values:

```typescript
// String enum for model types
enum ModelType {
  Classification = "classification",
  Regression = "regression",
  Clustering = "clustering",
}

// Literal type, lightweight alternative to enums
type Activation = "relu" | "sigmoid" | "tanh" | "softmax";

function createLayer(units: number, activation: Activation) {
  console.log(`Layer: ${units} units, activation: ${activation}`);
}

createLayer(128, "relu");
// createLayer(128, "linear");  // Error: not assignable to type Activation
```

## Map, Set, and Iterators

Modern data structures that are useful throughout AI programming:

```typescript
// Map for label counts (like Python's Counter)
function countLabels(labels: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

const labels = ["cat", "dog", "cat", "bird", "dog", "cat"];
const counts = countLabels(labels);
console.log(counts);  // Map { 'cat' => 3, 'dog' => 2, 'bird' => 1 }

// Set for unique values
const uniqueLabels = new Set(labels);
console.log(uniqueLabels);  // Set { 'cat', 'dog', 'bird' }
```

## Practical Patterns for AI Code

### Matrix Operations with Nested Arrays

Since we don't use NumPy in TypeScript, we work with arrays directly:

```typescript
type Matrix = number[][];
type Vector = number[];

function matMul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: Matrix = Array.from({ length: rows },
    () => new Array(cols).fill(0)
  );

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function transpose(m: Matrix): Matrix {
  return m[0].map((_, i) => m.map(row => row[i]));
}

function mean(v: Vector): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function standardDeviation(v: Vector): number {
  const avg = mean(v);
  const squaredDiffs = v.map(x => (x - avg) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}
```

### Configuration with Environment Variables

A pattern used in almost every AI project:

```typescript
interface AppConfig {
  googleApiKey: string;
  openaiApiKey: string;
  ollamaUrl: string;
  model: string;
}

function loadConfig(): AppConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  };

  return {
    googleApiKey: required("GOOGLE_API_KEY"),
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
    model: process.env.MODEL ?? "gemini-2.5-flash",
  };
}
```

### Progress Reporting for Long Operations

For long-running processes such as training loops or large batch predictions, providing real-time feedback is crucial. You can write a helper function that prints progress updates using `process.stdout.write` and standard escape sequences to overwrite the current terminal line.

```typescript
function printProgress(current: number, total: number, label: string): void {
  const pct = ((current / total) * 100).toFixed(1);
  process.stdout.write(`\r  ${label}: ${pct}% (${current}/${total})`);
  if (current === total) process.stdout.write("\n");
}

// Usage in a training loop
for (let epoch = 0; epoch < 100; epoch++) {
  // ... training logic ...
  printProgress(epoch + 1, 100, "Training");
}
```

## TypeScript Tutorial Wrap-up

This chapter covered the TypeScript features you will encounter throughout this book:

- **Types and interfaces** for defining data shapes and catching errors at compile time.
- **Async/await** for clean, readable API calls: essential for LLM and cloud service integration.
- **Classes** for encapsulating model logic, agents, and data structures.
- **Modules** for organizing code across files.
- **Generics** for writing reusable, type-safe utility functions.
- **Error handling** patterns for robust API interaction.
- **File I/O** for loading datasets and saving results.
- **Practical patterns** like matrix operations, configuration management, and progress reporting.

With these fundamentals in hand, you are ready to dive into the AI chapters. The next part covers machine learning with TypeScript.

