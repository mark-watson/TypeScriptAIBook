// sentence_similarity.ts - Sentence similarity using embeddings

import { pipeline } from "@huggingface/transformers";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] ** 2; nB += b[i] ** 2; }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

console.log("Loading sentence-transformers model...");
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

const sentences = [
  "The IRS has new tax laws.",
  "Congress debating the economy.",
  "The politician fled to South America.",
  "Canada and the US will be in the playoffs.",
  "The cat ran up the tree.",
  "The meal tasted good but was expensive.",
];

const embeddings = await Promise.all(
  sentences.map(async s => Array.from((await extractor(s, { pooling: "mean", normalize: true })).data as Float32Array)),
);

const pairs = sentences.flatMap((_, i) =>
  sentences.slice(i + 1).map((_, j) => ({
    score: cosineSimilarity(embeddings[i], embeddings[i + j + 1]),
    i, j: i + j + 1,
  })),
).sort((a, b) => b.score - a.score);

console.log("\nTop-8 most similar pairs:");
for (const { score, i, j } of pairs.slice(0, 8)) {
  console.log(`  ${score.toFixed(4)}  ${sentences[i]}`);
  console.log(`          ${sentences[j]}\n`);
}
