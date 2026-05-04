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
