// test_mzn.ts - Calling MiniZinc from TypeScript

import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function solveMiniZinc(modelFile: string, params: Record<string, number>): string {
  const dir = mkdtempSync(join(tmpdir(), "mzn-"));
  const paramFile = join(dir, "params.dzn");
  writeFileSync(paramFile, Object.entries(params).map(([k, v]) => `${k} = ${v};`).join("\n"));
  try {
    return execSync(`minizinc --solver coinbc ${modelFile} ${paramFile}`, { encoding: "utf-8", timeout: 30000 }).trim();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log(solveMiniZinc("test_mzn.mzn", { n: 30, m: 200 }));
