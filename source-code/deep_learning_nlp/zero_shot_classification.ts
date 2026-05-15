// zero_shot_classification.ts - Zero-shot text classification

import { pipeline } from "@huggingface/transformers";

console.log("Loading zero-shot classification model...");
const classifier = await pipeline("zero-shot-classification", "Xenova/mobilebert-uncased-mnli");

const text = "Hi, I recently bought a device from your company but it is not " +
  "working as advertised and I would like to get reimbursed!";
const candidateLabels = ["refund", "faq", "legal"];

console.log(`\nInput text: ${text}`);
console.log(`Candidate labels: ${JSON.stringify(candidateLabels)}\n`);

const result = await classifier(text, candidateLabels) as any;
console.log("Results:");
result.labels.forEach((label: string, i: number) =>
  console.log(`  ${label}: ${result.scores[i].toFixed(4)}`)
);
