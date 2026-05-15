import { readFileSync } from "node:fs";

export interface DataSet { xTrain: number[][]; yTrain: number[]; xTest: number[][]; yTest: number[] }

export function loadData(): DataSet {
  const parse = (p: string) => readFileSync(p, "utf-8").trim().split("\n").slice(1).map(l => l.split(",").map(Number));
  const [train, test] = ["labeled_cancer_data.csv", "labeled_test_data.csv"].map(parse);
  const split = (d: number[][]) => ({ x: d.map(r => r.slice(0, 9)), y: d.map(r => r[r.length - 1]) });
  const tr = split(train), te = split(test);
  console.log(`Training: ${tr.x.length}  Test: ${te.x.length}`);
  return { xTrain: tr.x, yTrain: tr.y, xTest: te.x, yTest: te.y };
}
