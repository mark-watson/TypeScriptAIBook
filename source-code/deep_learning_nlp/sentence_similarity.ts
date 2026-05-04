// sentence_similarity.ts - Sentence similarity using embeddings

import { pipeline } from "@huggingface/transformers";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
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

  // Encode all sentences
  const embeddings: number[][] = [];
  for (const sentence of sentences) {
    const output = await extractor(sentence, { pooling: "mean", normalize: true });
    embeddings.push(Array.from(output.data as Float32Array));
  }

  // Compute cosine similarities between all pairs
  const pairs: { score: number; i: number; j: number }[] = [];
  for (let i = 0; i < sentences.length - 1; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      pairs.push({
        score: cosineSimilarity(embeddings[i], embeddings[j]),
        i, j,
      });
    }
  }

  pairs.sort((a, b) => b.score - a.score);

  console.log("\nTop-8 most similar pairs:");
  for (const { score, i, j } of pairs.slice(0, 8)) {
    console.log(`  ${score.toFixed(4)}  ${sentences[i]}`);
    console.log(`          ${sentences[j]}\n`);
  }
}

main();
