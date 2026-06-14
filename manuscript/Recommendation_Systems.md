# Overview of Recommendation Systems (Optional Material)

Recommendation systems are a type of information filtering system that utilize historical data, such as past user behavior or interactions, to predict the likelihood of a user's interest in certain items or products. As an example application: if a product web site has 100K products that is too many for customers to browse through. Based on a customer's past purchases, finding other customers with similar purchases, etc. it is possible to filter the products shown to a customer.

**Note: This is an advanced topic and you will need to reference the linked documentation resources to fully understand the material.**

Writing recommendation systems is a common requirement for almost all businesses that sell products to customers. Before we get started we need to define two terms that you may not be familiar with: [Collaborative filtering](https://en.wikipedia.org/wiki/Collaborative_filtering): uses both similarities between users and items to calculate recommendations. This linked Wikipedia article also discusses content-based filtering which uses user and item features.

The [Movie Lens dataset](https://grouplens.org/datasets/movielens/) created by the GroupLens Research organization uses the user movie preference [https://movielens.org](https://movielens.org) dataset. This dataset is a standard for developing and evaluating recommendation system algorithms and models.

There are at least three good approaches to take:

- Use a turnkey recommendation system like [Amazon Personalize](https://aws.amazon.com/personalize/) that is a turn-key service on AWS.
- Use one of the standard libraries or TensorFlow implementations for the classic approach using [Matrix Factorization](https://en.wikipedia.org/wiki/Matrix_factorization_(recommender_systems)) for collaborative filtering.
- Use the [TensorFlow Recommenders](https://www.tensorflow.org/recommenders) library that supports multi-tower deep learning models.

In this chapter we build two recommendation systems from scratch in TypeScript: an **item-based collaborative filter** using adjusted cosine similarity, and an **embedding-based matrix factorization** model trained with stochastic gradient descent. No external ML libraries are required.

The examples for this chapter are in the directory **source-code/deep_learning_recommendation**.

## TensorFlow Recommenders

I used Google's TensorFlow Recommenders library for a work project. I recommend it because it has very good documentation, many examples using the Movie Lens dataset, and is fairly easy to adapt to general user/product recommendation systems.

We will refer to the documentation and examples at [https://www.tensorflow.org/recommenders](https://www.tensorflow.org/recommenders).

There are several types of data that could be used for recommending movies:

- User interactions (selecting movies).
- User data.
- Movie data based on text embedding of movie titles.

The TensorFlow Recommenders approach uses a multi-tower architecture. The **query tower** processes user features and the **candidate tower** processes item features. During training, the model learns to bring the embeddings of users and their preferred items closer together in the embedding space.

While TensorFlow Recommenders is a Python library, the concepts apply to any language. In this chapter we implement the core ideas in TypeScript:

1. An item-based collaborative filtering engine that uses adjusted cosine similarity.
2. An embedding matrix factorization model that learns dense user and item vectors via SGD, the same fundamental approach used inside TensorFlow Recommenders' retrieval models.

## Project Structure

The code is split into two TypeScript files:

```
deep_learning_recommendation/
├── package.json
├── collaborative_filtering.ts   // Item-based CF engine + evaluation
├── recommendation_demo.ts       // Embedding MF model + full demo
└── README.md
```

## Item-Based Collaborative Filtering

The simpler of our two approaches. The idea: if two movies tend to be rated similarly by the same users, those movies are similar. To recommend movies for a user, find movies similar to what they already liked.

### Cosine Similarity

Two users' rating vectors can be compared using **cosine similarity**, the cosine of the angle between them. Vectors pointing in the same direction (similar taste) produce values near 1; orthogonal vectors produce 0:

```typescript
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
```

We use `Map<string, number>` as a sparse vector: keys are movie IDs, values are ratings. The function accumulates the dot product only over keys that appear in both maps (movies rated by both users). The denominator normalizes by each vector's magnitude, producing a value in [-1, 1].

### Adjusted Cosine Similarity

Plain cosine similarity has a problem: some users are consistently generous (rating everything 4-5) while others are harsh (rating everything 1-3). This inflates similarity between items that happen to be rated by the same generous users.

**Adjusted cosine** solves this by subtracting each user's mean rating before computing the similarity:

```typescript
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
```

The key line is `const adjA = rA - mean`. If a user's mean is 4.0 and they rate movie A as 5, the adjusted rating is +1 (above average, they liked it). If they rate movie B as 3, the adjusted rating is -1 (below average, they didn't). This correctly captures that the user preferred A over B, regardless of their overall rating tendency.

### The Recommender Class

The `ItemBasedRecommender` class ties everything together:

```typescript
export class ItemBasedRecommender {
  private userRatings = new Map<string, Map<string, number>>();
  private itemRatings = new Map<string, Map<string, number>>();
  private userMeans = new Map<string, number>();
  private itemSimilarity = new Map<string, SimilarityEntry[]>();

  constructor(private topK: number = 20) {}
```

It maintains four lookup maps: user-to-item ratings, item-to-user ratings, per-user mean ratings, and a pre-computed similarity index. The `topK` parameter controls how many similar items are stored per movie, a higher value captures more relationships but uses more memory.

The `fit` method ingests ratings and pre-computes all similarities:

```typescript
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
```

The algorithm compares every pair of items and keeps the top-K most similar for each. This is an O(items² × users) operation, which is fine for our dataset but would need approximate nearest-neighbor techniques for millions of items.

### Predicting Ratings and Generating Recommendations

To predict how a user would rate an unseen movie, we find the most similar movies that the user *has* rated, and compute a weighted average:

```typescript
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
```

The weighting by similarity means that more similar movies have more influence on the prediction. If a user loved "The Matrix" (cosine 0.9 with "Inception") and disliked "The Notebook" (cosine 0.1 with "Inception"), the high similarity to "The Matrix" dominates the prediction for "Inception."

The `recommend` method simply predicts scores for all unrated items and returns the top N:

```typescript
  recommend(userId: string, n: number = 5): Recommendation[] {
    const rated = this.userRatings.get(userId);
    if (!rated) return [];

    const candidates: Recommendation[] = [];
    for (const itemId of this.itemRatings.keys()) {
      if (rated.has(itemId)) continue;
      const predictedScore = this.predict(userId, itemId);
      if (predictedScore > 0)
        candidates.push({ itemId, predictedScore });
    }
    candidates.sort((a, b) => b.predictedScore - a.predictedScore);
    return candidates.slice(0, n);
  }
```

### Evaluation Metrics

We evaluate recommendation quality using three metrics computed on held-out test ratings:

```typescript
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
```

- **MAE** (mean absolute error): average distance between predicted and actual ratings. Lower is better.
- **RMSE** (root-mean-square error): similar to MAE but penalizes large errors more heavily.
- **Coverage**: fraction of test ratings the model could make a prediction for. A model that can't predict anything is useless regardless of accuracy.


## Embedding Matrix Factorization

The collaborative filtering approach above works well but has a limitation: it can only compare items that share users who rated both. The **embedding matrix factorization** approach solves this by learning dense vector representations (embeddings) for every user and item.

This is the same core technique used in deep learning recommendation systems. TensorFlow Recommenders' retrieval models, for example, learn user and item embeddings in exactly this way, they just add more layers on top.

### How It Works

The idea is elegant: represent each user as a vector of `k` numbers and each item as another vector of `k` numbers. The predicted rating is the dot product of these vectors, plus bias terms:

```latexmath
\hat{r}_{ui} = \mu + b_u + b_i + \mathbf{p}_u \cdot \mathbf{q}_i
```

Where:
- `\mu`$ is the global mean rating
- `b_u`$ is the user bias (does this user rate things high or low?)
- `b_i`$ is the item bias (is this movie generally well-liked?)
- `\mathbf{p}_u`$ is the user embedding vector
- `\mathbf{q}_i`$ is the item embedding vector

The model learns all of these parameters by minimizing the squared error on training ratings plus L2 regularization to prevent overfitting:

```latexmath
\min \sum_{(u,i)} (r_{ui} - \hat{r}_{ui})^2 + \lambda(\|\mathbf{p}_u\|^2 + \|\mathbf{q}_i\|^2 + b_u^2 + b_i^2)
```

### The Training Loop

We train with **stochastic gradient descent (SGD)**: for each rating in the training set, compute the prediction error and nudge the embeddings in the direction that reduces that error:

```typescript
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
```

The constructor takes four hyperparameters: the embedding dimension `k` controls how many latent factors are learned (8 means each user and movie is described by 8 numbers); the learning rate `lr` controls the step size during gradient descent; the regularization strength `reg` prevents overfitting; and `epochs` controls how many passes over the data.

The core SGD update inside the `fit` method:

```typescript
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
```

Let's trace through one update step:

1. Compute the predicted rating as the dot product of user and item embeddings, plus biases and the global mean.
2. Compute `error = actual - predicted`.
3. Update the biases: move them toward reducing the error, with a small regularization pull toward zero.
4. Update the embeddings: this is the key step. Each dimension of the user embedding is nudged by `lr * (error * itemEmbed[d])`, the user vector moves toward the item vector when the error is positive (we under-predicted, the user liked this more than expected) and away when negative. The item embedding is updated symmetrically.

Notice the careful use of `uOld` and `iOld`: we save the values before updating because both the user and item embeddings depend on each other's pre-update values.

### What the Embeddings Capture

After training, the learned embeddings capture **latent factors**, abstract properties that the model discovers on its own. In a movie dataset, these might correspond to genre preferences, mood, era, or other patterns that humans might not explicitly label.

The `similarItems` method reveals what the model learned by computing cosine similarity between item embeddings:

```typescript
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
```

In our demo, the model correctly learns that "The Matrix" is most similar to "Mad Max: Fury Road" (both are sci-fi/action) and "Die Hard" (action), while being dissimilar to romance films, without ever being told about genres.

### Synthetic Dataset

To make the demo self-contained and reproducible, we generate synthetic ratings with a deterministic PRNG:

```typescript
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Each synthetic user has random genre preferences. Their rating for a movie is `3 + genre_affinity + noise`, clamped to [1, 5]. This creates realistic patterns: sci-fi fans rate sci-fi movies higher, romance fans prefer romance, and there is enough overlap that the models can discover these clusters.

## Running the Examples

Install dependencies and run:

```bash
cd source-code/deep_learning_recommendation
npm install
npx tsx recommendation_demo.ts
```

Here is typical output:

```text
=== Embedding-Based Recommendation System ===

Dataset: 50 users × 15 movies
Training ratings: 346  Test ratings: 104

--- Part 1: Embedding Matrix Factorization (SGD) ---

Training:
  Epoch  10: RMSE = 0.8454
  Epoch  20: RMSE = 0.7917
  Epoch  30: RMSE = 0.7639
  Epoch  40: RMSE = 0.7485
  Epoch  50: RMSE = 0.7392
  Epoch  60: RMSE = 0.7325

Model: 50 users, 15 items, embedding dim = 8

Test set evaluation:
  MAE  = 0.6332
  RMSE = 0.8379

Movies rated by user_0:
  The Notebook             → 2
  Pulp Fiction             → 2
  Blade Runner 2049        → 3
  Mad Max: Fury Road       → 3
  Arrival                  → 3
  Die Hard                 → 3
  When Harry Met Sally     → 3

Top recommendations for user_0:
  Interstellar             (predicted: 3.04)
  Casablanca               (predicted: 2.83)
  Pride & Prejudice        (predicted: 2.78)
  The Matrix               (predicted: 2.78)
  Amélie                   (predicted: 2.73)

Similar items to 'The Matrix' (by learned embedding):
  Mad Max: Fury Road       (cosine: 0.829)
  Die Hard                 (cosine: 0.656)
  Inception                (cosine: 0.195)
  The Notebook             (cosine: 0.138)
  Amélie                   (cosine: 0.063)
```

The training RMSE drops steadily as the model learns, and the test-set metrics confirm good generalization. The embedding-based model discovers that "The Matrix" is most similar to "Mad Max: Fury Road" and "Die Hard" (all action-heavy movies), a sensible result given the genre-based preferences in our synthetic data.

You can also run the standalone collaborative filtering demo with a small hand-crafted dataset:

```bash
npx tsx collaborative_filtering.ts
```

```text
=== Item-Based Collaborative Filtering Demo ===

Users: 6  Items: 8  Similarity pairs: 18

Recommendations for alice:
  The Dark Knight      (predicted: 5.00)
  Pulp Fiction         (predicted: 1.44)
  Titanic              (predicted: 1.00)

Recommendations for bob:
  Interstellar         (predicted: 4.39)
  The Notebook         (predicted: 4.00)

Recommendations for carol:
  Pulp Fiction         (predicted: 4.67)
  Inception            (predicted: 2.00)
  Interstellar         (predicted: 2.00)
```

Alice likes sci-fi (rated "The Matrix" and "Inception" as 5), so the system recommends "The Dark Knight", it shares high similarity with her favorites because users who like sci-fi/action tend to like both. Carol prefers romance but hasn't seen "Pulp Fiction", it gets recommended because Dave (who has similar romance preferences) rated it well.

## Comparing the Two Approaches

The demo's model comparison section shows both models evaluated on the same test set:

```text
--- Model Comparison ---

                       MAE     RMSE
  Embedding MF      0.6332  0.8379
  Item-Based CF     0.5909  0.8004
```

On this small dataset, item-based CF edges ahead, it has enough direct rating overlap between items to make accurate predictions. However, the embedding model has key advantages that matter at scale:

- **Generalization**: embeddings can predict ratings for user-item pairs that share no direct rating overlap, by capturing latent patterns.
- **Scalability**: once trained, predictions are a simple dot product, O(k) per prediction, compared to scanning a similarity list.
- **Extensibility**: the embedding approach naturally extends to deep learning. By adding neural network layers on top of the embeddings, you get the multi-tower architectures used by TensorFlow Recommenders and production systems at Netflix, YouTube, and Alibaba.

## Using the API in Your Own Code

You can use either recommender in your own TypeScript code:

```typescript
import { ItemBasedRecommender } from "./collaborative_filtering.js";
import { EmbeddingRecommender } from "./recommendation_demo.js";

// Item-based collaborative filtering
const cfRec = new ItemBasedRecommender(20);
cfRec.fit(myRatings);
const recs = cfRec.recommend("user123", 10);

// Embedding matrix factorization
const embedRec = new EmbeddingRecommender(16, 0.005, 0.02, 100);
embedRec.fit(myRatings);
const ratedItems = new Set(myRatings
  .filter(r => r.userId === "user123")
  .map(r => r.itemId));
const topPicks = embedRec.recommend("user123", ratedItems, 10);
```

Both models expect an array of `Rating` objects: `{ userId: string, itemId: string, score: number }`. Split your data into training and test sets before fitting, and use the `evaluate` functions to measure prediction quality.

## Recommendation Systems Wrap-up

In this chapter we built two recommendation systems from scratch, demonstrating the progression from simple similarity-based methods to embedding-based matrix factorization, the foundation of modern deep learning recommendation systems.

The key ideas to take away:

- **Collaborative filtering** discovers user preferences from rating patterns: users who agreed in the past will agree in the future.
- **Cosine similarity** measures how aligned two rating vectors are; **adjusted cosine** corrects for per-user rating biases.
- **Embedding matrix factorization** learns dense vector representations that capture latent factors, enabling predictions even for user-item pairs with no direct rating overlap.
- **SGD training** iteratively reduces prediction error by nudging embeddings toward the observed ratings.

If you need to build a production recommendation system, consider these resources and alternatives:

- Consider using [Amazon Personalize](https://aws.amazon.com/personalize/) which is a turn-key service on AWS.
- Consider using Google's turn-key [Recommendations AI](https://cloud.google.com/recommendations).
- For a deeper dive into embedding-based models, study the [TensorFlow Recommenders](https://www.tensorflow.org/recommenders) tutorials, our `EmbeddingRecommender` implements the same core mathematics.
- For TypeScript-native solutions at scale, implement the models in this chapter using TensorFlow.js on Node.js to leverage GPU acceleration.
- A research idea: transform input training data to a textual representation for input to a Transformer model, based on the paper [Behavior Sequence Transformer for E-commerce Recommendation in Alibaba](https://arxiv.org/abs/1905.06874).


