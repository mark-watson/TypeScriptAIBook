// recommendation_demo.ts — Embedding-based matrix factorization recommender
// Copyright 2022-2026 Mark Watson. All rights reserved.
//
// Implements a two-tower embedding model trained with stochastic gradient
// descent on explicit ratings. This is the core technique behind deep
// learning recommendation systems like those described in the TensorFlow
// Recommenders documentation.

import {
  ItemBasedRecommender,
  evaluate,
  type Rating,
  type EvalResult,
} from "./collaborative_filtering.js";

// ── Synthetic MovieLens-style Dataset ──────────────────────────────

interface Movie { id: string; title: string; genres: string[] }

const MOVIES: Movie[] = [
  { id: "m1",  title: "The Matrix",          genres: ["sci-fi", "action"] },
  { id: "m2",  title: "Inception",           genres: ["sci-fi", "thriller"] },
  { id: "m3",  title: "Interstellar",        genres: ["sci-fi", "drama"] },
  { id: "m4",  title: "The Notebook",        genres: ["romance", "drama"] },
  { id: "m5",  title: "Titanic",             genres: ["romance", "drama"] },
  { id: "m6",  title: "Pride & Prejudice",   genres: ["romance"] },
  { id: "m7",  title: "The Dark Knight",     genres: ["action", "thriller"] },
  { id: "m8",  title: "Pulp Fiction",        genres: ["action", "drama"] },
  { id: "m9",  title: "Blade Runner 2049",   genres: ["sci-fi", "thriller"] },
  { id: "m10", title: "Amélie",              genres: ["romance", "comedy"] },
  { id: "m11", title: "Mad Max: Fury Road",  genres: ["action", "sci-fi"] },
  { id: "m12", title: "Casablanca",          genres: ["romance", "drama"] },
  { id: "m13", title: "Arrival",             genres: ["sci-fi", "drama"] },
  { id: "m14", title: "Die Hard",            genres: ["action", "thriller"] },
  { id: "m15", title: "When Harry Met Sally", genres: ["romance", "comedy"] },
];

const MOVIE_MAP = new Map(MOVIES.map(m => [m.id, m]));

/** Deterministic PRNG (mulberry32) for reproducible results. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate synthetic user ratings with genre-based preferences. */
function generateRatings(
  nUsers: number, seed = 42,
): { train: Rating[]; test: Rating[] } {
  const rng = mulberry32(seed);
  const allGenres = ["sci-fi", "action", "thriller", "romance", "drama", "comedy"];

  const train: Rating[] = [], test: Rating[] = [];

  for (let u = 0; u < nUsers; u++) {
    const userId = `user_${u}`;
    // Each user has random genre preferences in [-1, 1]
    const prefs = new Map<string, number>();
    for (const g of allGenres) prefs.set(g, rng() * 2 - 1);

    for (const movie of MOVIES) {
      if (rng() > 0.6) continue; // not every user rates every movie
      // Score = base 3 + genre affinity + noise
      let affinity = 0;
      for (const g of movie.genres) affinity += prefs.get(g) ?? 0;
      const raw = 3 + affinity + (rng() - 0.5);
      const score = Math.max(1, Math.min(5, Math.round(raw)));
      const rating = { userId, itemId: movie.id, score };
      // 80% train, 20% test
      (rng() < 0.8 ? train : test).push(rating);
    }
  }
  return { train, test };
}

// ── Embedding Matrix Factorization ─────────────────────────────────

/**
 * Matrix factorization via SGD (stochastic gradient descent).
 *
 * Each user and item gets a dense embedding vector of length `k`.
 * The predicted rating = dot(userEmbed, itemEmbed) + userBias + itemBias + globalMean.
 *
 * The model minimises: Σ (actual - predicted)² + λ(‖embeddings‖²)
 */
export class EmbeddingRecommender {
  private userEmbeddings = new Map<string, number[]>();
  private itemEmbeddings = new Map<string, number[]>();
  private userBias = new Map<string, number>();
  private itemBias = new Map<string, number>();
  private globalMean = 0;

  constructor(
    private k: number = 8,       // embedding dimension
    private lr: number = 0.005,  // learning rate
    private reg: number = 0.02,  // L2 regularization
    private epochs: number = 50,
  ) {}

  /** Initialize embedding to small random values. */
  private initEmbed(rng: () => number): number[] {
    return Array.from({ length: this.k }, () => (rng() - 0.5) * 0.1);
  }

  /** Train the model on a set of ratings. */
  fit(ratings: Rating[], verbose = true): void {
    const rng = mulberry32(7);

    // Compute global mean rating
    this.globalMean = ratings.reduce((s, r) => s + r.score, 0) / ratings.length;

    // Initialise embeddings and biases
    for (const { userId, itemId } of ratings) {
      if (!this.userEmbeddings.has(userId)) {
        this.userEmbeddings.set(userId, this.initEmbed(rng));
        this.userBias.set(userId, 0);
      }
      if (!this.itemEmbeddings.has(itemId)) {
        this.itemEmbeddings.set(itemId, this.initEmbed(rng));
        this.itemBias.set(itemId, 0);
      }
    }

    // SGD training loop
    for (let epoch = 0; epoch < this.epochs; epoch++) {
      let totalLoss = 0;
      // Shuffle ratings each epoch
      const shuffled = [...ratings];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      for (const { userId, itemId, score } of shuffled) {
        const uEmbed = this.userEmbeddings.get(userId)!;
        const iEmbed = this.itemEmbeddings.get(itemId)!;
        const uBias = this.userBias.get(userId)!;
        const iBias = this.itemBias.get(itemId)!;

        // Predicted rating = dot product + biases + global mean
        let pred = this.globalMean + uBias + iBias;
        for (let d = 0; d < this.k; d++) pred += uEmbed[d] * iEmbed[d];

        const error = score - pred;
        totalLoss += error ** 2;

        // Update biases
        this.userBias.set(userId, uBias + this.lr * (error - this.reg * uBias));
        this.itemBias.set(itemId, iBias + this.lr * (error - this.reg * iBias));

        // Update embeddings
        for (let d = 0; d < this.k; d++) {
          const uOld = uEmbed[d], iOld = iEmbed[d];
          uEmbed[d] += this.lr * (error * iOld - this.reg * uOld);
          iEmbed[d] += this.lr * (error * uOld - this.reg * iOld);
        }
      }

      if (verbose && (epoch + 1) % 10 === 0) {
        const rmse = Math.sqrt(totalLoss / ratings.length);
        console.log(`  Epoch ${String(epoch + 1).padStart(3)}: RMSE = ${rmse.toFixed(4)}`);
      }
    }
  }

  /** Predict a single user-item rating. */
  predict(userId: string, itemId: string): number {
    const uEmbed = this.userEmbeddings.get(userId);
    const iEmbed = this.itemEmbeddings.get(itemId);
    if (!uEmbed || !iEmbed) return this.globalMean;
    const uBias = this.userBias.get(userId) ?? 0;
    const iBias = this.itemBias.get(itemId) ?? 0;
    let pred = this.globalMean + uBias + iBias;
    for (let d = 0; d < this.k; d++) pred += uEmbed[d] * iEmbed[d];
    return Math.max(1, Math.min(5, pred));
  }

  /** Recommend top-N unrated items for a user. */
  recommend(
    userId: string, ratedItems: Set<string>, n: number = 5,
  ): { itemId: string; predictedScore: number }[] {
    const results: { itemId: string; predictedScore: number }[] = [];
    for (const itemId of this.itemEmbeddings.keys()) {
      if (ratedItems.has(itemId)) continue;
      results.push({ itemId, predictedScore: this.predict(userId, itemId) });
    }
    results.sort((a, b) => b.predictedScore - a.predictedScore);
    return results.slice(0, n);
  }

  /** Evaluate on a test set. */
  evaluate(testRatings: Rating[]): { mae: number; rmse: number } {
    let sumAbsErr = 0, sumSqErr = 0;
    for (const { userId, itemId, score } of testRatings) {
      const pred = this.predict(userId, itemId);
      sumAbsErr += Math.abs(pred - score);
      sumSqErr += (pred - score) ** 2;
    }
    const n = testRatings.length;
    return {
      mae: n > 0 ? sumAbsErr / n : 0,
      rmse: n > 0 ? Math.sqrt(sumSqErr / n) : 0,
    };
  }

  /** Return the learned embedding for an item (for inspection). */
  getItemEmbedding(itemId: string): number[] | undefined {
    return this.itemEmbeddings.get(itemId);
  }

  /** Find the K most similar items by embedding cosine similarity. */
  similarItems(itemId: string, topK: number = 5): { id: string; sim: number }[] {
    const target = this.itemEmbeddings.get(itemId);
    if (!target) return [];
    const results: { id: string; sim: number }[] = [];
    for (const [id, emb] of this.itemEmbeddings) {
      if (id === itemId) continue;
      let dot = 0, nA = 0, nB = 0;
      for (let d = 0; d < this.k; d++) {
        dot += target[d] * emb[d];
        nA += target[d] ** 2;
        nB += emb[d] ** 2;
      }
      const sim = nA > 0 && nB > 0 ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
      results.push({ id, sim });
    }
    results.sort((a, b) => b.sim - a.sim);
    return results.slice(0, topK);
  }

  stats() {
    return {
      users: this.userEmbeddings.size,
      items: this.itemEmbeddings.size,
      embeddingDim: this.k,
      globalMean: this.globalMean,
    };
  }
}

// ── Main Demo ──────────────────────────────────────────────────────

const NUM_USERS = 50;
const { train, test } = generateRatings(NUM_USERS);

console.log("=== Embedding-Based Recommendation System ===");
console.log(`\nDataset: ${NUM_USERS} users × ${MOVIES.length} movies`);
console.log(`Training ratings: ${train.length}  Test ratings: ${test.length}\n`);

// ── Part 1: Embedding Matrix Factorization ──────────────────────

console.log("--- Part 1: Embedding Matrix Factorization (SGD) ---\n");
console.log("Training:");

const embedRec = new EmbeddingRecommender(8, 0.005, 0.02, 60);
embedRec.fit(train);

const embedStats = embedRec.stats();
console.log(`\nModel: ${embedStats.users} users, ${embedStats.items} items, ` +
  `embedding dim = ${embedStats.embeddingDim}`);

const embedEval = embedRec.evaluate(test);
console.log(`\nTest set evaluation:`);
console.log(`  MAE  = ${embedEval.mae.toFixed(4)}`);
console.log(`  RMSE = ${embedEval.rmse.toFixed(4)}`);

// Show recommendations for a sample user
const sampleUser = "user_0";
const ratedByUser = new Set(
  train.filter(r => r.userId === sampleUser).map(r => r.itemId),
);

console.log(`\nMovies rated by ${sampleUser}:`);
for (const r of train.filter(r => r.userId === sampleUser))
  console.log(`  ${MOVIE_MAP.get(r.itemId)!.title.padEnd(24)} → ${r.score}`);

const embedRecs = embedRec.recommend(sampleUser, ratedByUser, 5);
console.log(`\nTop recommendations for ${sampleUser}:`);
for (const { itemId, predictedScore } of embedRecs)
  console.log(`  ${MOVIE_MAP.get(itemId)!.title.padEnd(24)} (predicted: ${predictedScore.toFixed(2)})`);

// Show similar items via learned embeddings
console.log("\nSimilar items to 'The Matrix' (by learned embedding):");
for (const { id, sim } of embedRec.similarItems("m1", 5))
  console.log(`  ${MOVIE_MAP.get(id)!.title.padEnd(24)} (cosine: ${sim.toFixed(3)})`);

// ── Part 2: Item-Based Collaborative Filtering ──────────────────

console.log("\n\n--- Part 2: Item-Based Collaborative Filtering ---\n");

const cfRec = new ItemBasedRecommender(10);
cfRec.fit(train);

const cfStats = cfRec.stats();
console.log(`Model: ${cfStats.users} users, ${cfStats.items} items, ` +
  `${cfStats.similarityPairs} similarity pairs\n`);

const cfEval = evaluate(cfRec, test);
console.log(`Test set evaluation:`);
console.log(`  MAE      = ${cfEval.mae.toFixed(4)}`);
console.log(`  RMSE     = ${cfEval.rmse.toFixed(4)}`);
console.log(`  Coverage = ${(cfEval.coverage * 100).toFixed(1)}%`);

const cfRecs = cfRec.recommend(sampleUser, 5);
console.log(`\nTop recommendations for ${sampleUser}:`);
for (const { itemId, predictedScore } of cfRecs)
  console.log(`  ${MOVIE_MAP.get(itemId)!.title.padEnd(24)} (predicted: ${predictedScore.toFixed(2)})`);

// ── Comparison ──────────────────────────────────────────────────

console.log("\n\n--- Model Comparison ---\n");
console.log("                       MAE     RMSE");
console.log(`  Embedding MF      ${embedEval.mae.toFixed(4)}  ${embedEval.rmse.toFixed(4)}`);
console.log(`  Item-Based CF     ${cfEval.mae.toFixed(4)}  ${cfEval.rmse.toFixed(4)}`);
console.log(
  `\nThe embedding model learns dense vector representations that capture`
);
console.log(
  `latent factors (genre preferences, mood, etc.) while item-based CF`
);
console.log(
  `relies on explicit rating overlap between items.`
);
