// zero_shot_classification.ts - Zero-shot text classification

import { pipeline } from "@huggingface/transformers";

async function main() {
  console.log("Loading zero-shot classification model...");
  const classifier = await pipeline(
    "zero-shot-classification",
    "Xenova/mobilebert-uncased-mnli"
  );

  const text =
    "Hi, I recently bought a device from your company but it is not " +
    "working as advertised and I would like to get reimbursed!";

  const candidateLabels = ["refund", "faq", "legal"];

  console.log(`\nInput text: ${text}`);
  console.log(`Candidate labels: ${JSON.stringify(candidateLabels)}\n`);

  const result = await classifier(text, candidateLabels);
  console.log("Results:");
  const labels = (result as any).labels as string[];
  const scores = (result as any).scores as number[];
  labels.forEach((label: string, i: number) => {
    console.log(`  ${label}: ${scores[i].toFixed(4)}`);
  });
}

main();
