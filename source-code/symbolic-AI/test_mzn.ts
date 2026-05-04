// test_mzn.ts - Calling MiniZinc from TypeScript

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

function solveMiniZinc(
  modelFile: string,
  params: Record<string, number>
): string {
  const paramLines = Object.entries(params)
    .map(([key, val]) => `${key} = ${val};`);
  const paramFile = "params.dzn";
  writeFileSync(paramFile, paramLines.join("\n"));

  try {
    const result = execSync(
      `minizinc --solver coinbc ${modelFile} ${paramFile}`,
      { encoding: "utf-8", timeout: 30000 }
    );
    return result.trim();
  } finally {
    try { unlinkSync(paramFile); } catch {}
  }
}

const result = solveMiniZinc("test_mzn.mzn", { n: 30, m: 200 });
console.log(result);
