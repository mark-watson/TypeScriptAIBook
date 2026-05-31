import { readFileSync, existsSync } from "node:fs";

export interface DataSet { xTrain: number[][]; yTrain: number[]; xTest: number[][]; yTest: number[] }

function parseCSV(path: string): number[][] {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  const lines = readFileSync(path, "utf-8").trim().split("\n");
  if (lines.length < 2) throw new Error(`File is empty or has no data rows: ${path}`);
  return lines.slice(1).map((l, i) => {
    const vals = l.split(",").map(Number);
    if (vals.some(v => Number.isNaN(v))) throw new Error(`Non-numeric value at line ${i + 2} in ${path}`);
    return vals;
  });
}

export function loadData(): DataSet {
  const [train, test] = ["labeled_cancer_data.csv", "labeled_test_data.csv"].map(parseCSV);
  const nFeatures = train[0].length - 1;
  if (test[0].length - 1 !== nFeatures) throw new Error("Feature count mismatch between train and test data");
  const split = (d: number[][]) => ({ x: d.map(r => r.slice(0, -1)), y: d.map(r => r[r.length - 1]) });
  const tr = split(train), te = split(test);
  console.log(`Training: ${tr.x.length}  Test: ${te.x.length}  Features: ${nFeatures}`);
  return { xTrain: tr.x, yTrain: tr.y, xTest: te.x, yTest: te.y };
}
