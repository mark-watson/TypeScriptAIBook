// test_mzn.ts - Calling MiniZinc from TypeScript

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

function solveMiniZinc(modelFile: string, params: Record<string, number>): string {
  const paramFile = "params.dzn";
  writeFileSync(paramFile, Object.entries(params).map(([k, v]) => `${k} = ${v};`).join("\n"));
  try {
    return execSync(`minizinc --solver coinbc ${modelFile} ${paramFile}`, { encoding: "utf-8", timeout: 30000 }).trim();
  } finally { try { unlinkSync(paramFile); } catch {} }
}

console.log(solveMiniZinc("test_mzn.mzn", { n: 30, m: 200 }));
