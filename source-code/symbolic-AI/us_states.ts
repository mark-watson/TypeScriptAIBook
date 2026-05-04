// us_states.ts - US map coloring with MiniZinc

import { execSync } from "node:child_process";

try {
  const result = execSync(
    "minizinc --solver coinbc us_states.mzn",
    { encoding: "utf-8", timeout: 60000 }
  );
  console.log(result.trim());
} catch (err: any) {
  if (err.stderr) {
    console.error("MiniZinc error:", err.stderr);
  } else {
    console.error("Error running MiniZinc. Is it installed? (brew install minizinc)");
  }
}
