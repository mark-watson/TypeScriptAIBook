// collaborative_filtering.ts — Item-based collaborative filtering engine
// Copyright 2022-2026 Mark Watson. All rights reserved.

// ── Types ───────────────────────────────────────────────────────────

export interface Rating {
  userId: string;
  itemId: string;
  score: number;
}

export interface SimilarityEntry {
  itemId: string;
  similarity: number;
}

export interface Recommendation {
  itemId: string;
  predictedScore: number;
}

// ── Vector Math ─────────────────────────────────────────────────────

/** Cosine similarity between two sparse rating vectors. */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [key, valA] of a) {
    const valB = b.get(key);
    if (valB !== undefined) dot += valA * valB;
    normA += valA ** 2;
  }
  for (const [, valB] of b) normB += valB ** 2;
  return normA > 0 && normB > 0
    ? dot / (Math.sqrt(normA) * Math.sqrt(normB))
    : 0;
}

/** Adjusted cosine: subtract per-user mean before comparing. */
export function adjustedCosineSimilarity(
  itemA: string,
  itemB: string,
  userRatings: Map<string, Map<string, number>>,
  userMeans: Map<string, number>,
): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [userId, ratings] of userRatings) {
    const rA = ratings.get(itemA), rB = ratings.get(itemB);
    if (rA === undefined || rB === undefined) continue;
    const mean = userMeans.get(userId) ?? 0;
    const adjA = rA - mean, adjB = rB - mean;
    dot += adjA * adjB;
    normA += adjA ** 2;
    normB += adjB ** 2;
  }
  return normA > 0 && normB > 0
    ? dot / (Math.sqrt(normA) * Math.sqrt(normB))
    : 0;
}

// ── Recommender ─────────────────────────────────────────────────────

export class ItemBasedRecommender {
  private userRatings = new Map<string, Map<string, number>>();
  private itemRatings = new Map<string, Map<string, number>>();
  private userMeans = new Map<string, number>();
  private itemSimilarity = new Map<string, SimilarityEntry[]>();

  constructor(private topK: number = 20) {}

  /** Ingest all ratings and build the similarity index. */
  fit(ratings: Rating[]): void {
    // Build user→{item→score} and item→{user→score} lookup maps
    for (const { userId, itemId, score } of ratings) {
      if (!this.userRatings.has(userId))
        this.userRatings.set(userId, new Map());
      this.userRatings.get(userId)!.set(itemId, score);

      if (!this.itemRatings.has(itemId))
        this.itemRatings.set(itemId, new Map());
      this.itemRatings.get(itemId)!.set(userId, score);
    }

    // Compute per-user mean rating (used for adjusted cosine)
    for (const [userId, items] of this.userRatings) {
      let sum = 0;
      for (const [, s] of items) sum += s;
      this.userMeans.set(userId, sum / items.size);
    }

    // Pre-compute top-K most similar items for every item
    const allItems = [...this.itemRatings.keys()];
    for (const itemA of allItems) {
      const sims: SimilarityEntry[] = [];
      for (const itemB of allItems) {
        if (itemA === itemB) continue;
        const sim = adjustedCosineSimilarity(
          itemA, itemB, this.userRatings, this.userMeans,
        );
        if (sim > 0) sims.push({ itemId: itemB, similarity: sim });
      }
      sims.sort((a, b) => b.similarity - a.similarity);
      this.itemSimilarity.set(itemA, sims.slice(0, this.topK));
    }
  }

  /** Predict a user's score for an item they haven't rated. */
  predict(userId: string, itemId: string): number {
    const userItems = this.userRatings.get(userId);
    if (!userItems) return 0;
    const neighbors = this.itemSimilarity.get(itemId) ?? [];

    let weightedSum = 0, simSum = 0;
    for (const { itemId: neighborId, similarity } of neighbors) {
      const rating = userItems.get(neighborId);
      if (rating === undefined) continue;
      weightedSum += similarity * rating;
      simSum += Math.abs(similarity);
    }
    return simSum > 0 ? weightedSum / simSum : 0;
  }

  /** Recommend top-N items for a user. */
  recommend(userId: string, n: number = 5): Recommendation[] {
    const rated = this.userRatings.get(userId);
    if (!rated) return [];

    const candidates: Recommendation[] = [];
    for (const itemId of this.itemRatings.keys()) {
      if (rated.has(itemId)) continue; // skip already-rated items
      const predictedScore = this.predict(userId, itemId);
      if (predictedScore > 0)
        candidates.push({ itemId, predictedScore });
    }
    candidates.sort((a, b) => b.predictedScore - a.predictedScore);
    return candidates.slice(0, n);
  }

  /** Summary statistics. */
  stats() {
    return {
      users: this.userRatings.size,
      items: this.itemRatings.size,
      similarityPairs: [...this.itemSimilarity.values()]
        .reduce((sum, arr) => sum + arr.length, 0),
    };
  }
}

// ── Evaluation ──────────────────────────────────────────────────────

export interface EvalResult { mae: number; rmse: number; coverage: number }

/**
 * Evaluate recommender accuracy on held-out test ratings.
 * MAE  = mean absolute error of predicted vs. actual score.
 * RMSE = root-mean-square error.
 * Coverage = fraction of test ratings the model could predict.
 */
export function evaluate(
  recommender: ItemBasedRecommender,
  testRatings: Rating[],
): EvalResult {
  let sumAbsErr = 0, sumSqErr = 0, predicted = 0;
  for (const { userId, itemId, score } of testRatings) {
    const pred = recommender.predict(userId, itemId);
    if (pred > 0) {
      sumAbsErr += Math.abs(pred - score);
      sumSqErr += (pred - score) ** 2;
      predicted++;
    }
  }
  return {
    mae: predicted > 0 ? sumAbsErr / predicted : 0,
    rmse: predicted > 0 ? Math.sqrt(sumSqErr / predicted) : 0,
    coverage: testRatings.length > 0 ? predicted / testRatings.length : 0,
  };
}

// ── Standalone Demo ────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  // Small hand-crafted dataset: 6 users × 8 movies
  const movieNames: Record<string, string> = {
    m1: "The Matrix",     m2: "Inception",       m3: "Interstellar",
    m4: "The Notebook",   m5: "Titanic",         m6: "Pride & Prejudice",
    m7: "The Dark Knight", m8: "Pulp Fiction",
  };

  const data: Rating[] = [
    // Alice: likes sci-fi
    { userId: "alice", itemId: "m1", score: 5 },
    { userId: "alice", itemId: "m2", score: 5 },
    { userId: "alice", itemId: "m3", score: 4 },
    { userId: "alice", itemId: "m4", score: 1 },
    // Bob: likes sci-fi + action
    { userId: "bob", itemId: "m1", score: 4 },
    { userId: "bob", itemId: "m2", score: 5 },
    { userId: "bob", itemId: "m7", score: 5 },
    { userId: "bob", itemId: "m8", score: 4 },
    // Carol: likes romance
    { userId: "carol", itemId: "m4", score: 5 },
    { userId: "carol", itemId: "m5", score: 5 },
    { userId: "carol", itemId: "m6", score: 4 },
    { userId: "carol", itemId: "m1", score: 2 },
    // Dave: likes romance + drama
    { userId: "dave", itemId: "m4", score: 4 },
    { userId: "dave", itemId: "m5", score: 5 },
    { userId: "dave", itemId: "m6", score: 5 },
    { userId: "dave", itemId: "m8", score: 3 },
    // Eve: likes action
    { userId: "eve", itemId: "m7", score: 5 },
    { userId: "eve", itemId: "m8", score: 5 },
    { userId: "eve", itemId: "m1", score: 4 },
    { userId: "eve", itemId: "m3", score: 3 },
    // Frank: mixed tastes
    { userId: "frank", itemId: "m2", score: 4 },
    { userId: "frank", itemId: "m5", score: 3 },
    { userId: "frank", itemId: "m7", score: 4 },
    { userId: "frank", itemId: "m3", score: 5 },
  ];

  console.log("=== Item-Based Collaborative Filtering Demo ===\n");

  const rec = new ItemBasedRecommender(5);
  rec.fit(data);

  const s = rec.stats();
  console.log(`Users: ${s.users}  Items: ${s.items}  Similarity pairs: ${s.similarityPairs}\n`);

  for (const user of ["alice", "bob", "carol", "eve"]) {
    const recs = rec.recommend(user, 3);
    console.log(`Recommendations for ${user}:`);
    for (const { itemId, predictedScore } of recs)
      console.log(`  ${movieNames[itemId].padEnd(20)} (predicted: ${predictedScore.toFixed(2)})`);
    console.log();
  }
}
