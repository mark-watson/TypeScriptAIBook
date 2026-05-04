# Overview of Recommendation Systems (Optional Material)

Recommendation systems are a type of information filtering system that utilize historical data, such as past user behavior or interactions, to predict the likelihood of a user's interest in certain items or products. As an example application: if a product web site has 100K products that is too many for customers to browse through. Based on a customer's past purchases, finding other customers with similar purchases, etc. it is possible to filter the products shown to a customer.

**Note: This is an advanced topic and you will need to reference the linked documentation resources to fully understand the material.**

Writing recommendation systems is a common requirement for almost all businesses that sell products to customers. Before we get started we need to define two terms that you may not be familiar with: [Collaborative filtering](https://en.wikipedia.org/wiki/Collaborative_filtering): uses both similarities between users and items to calculate recommendations. This linked Wikipedia article also discusses content-based filtering which uses user and item features.

The [Movie Lens dataset](https://grouplens.org/datasets/movielens/) created by the GroupLens Research organization uses the user movie preference [https://movielens.org](https://movielens.org) dataset. This dataset is a standard for developing and evaluating recommendation system algorithms and models.

There are at least three good approaches to take:

- Use a turnkey recommendation system like [Amazon Personalize](https://aws.amazon.com/personalize/) that is a turn-key service on AWS.
- Use one of the standard libraries or TensorFlow implementations for the classic approach using [Matrix Factorization](https://en.wikipedia.org/wiki/Matrix_factorization_(recommender_systems)) for collaborative filtering.
- Use the [TensorFlow Recommenders](https://www.tensorflow.org/recommenders) library that supports multi-tower deep learning models.

We will not write any recommendation systems from scratch in this chapter. We will review the concepts and point you to resources for building them.

## TensorFlow Recommenders

I used Google's TensorFlow Recommenders library for a work project. I recommend it because it has very good documentation, many examples using the Movie Lens dataset, and is fairly easy to adapt to general user/product recommendation systems.

We will refer to the documentation and examples at [https://www.tensorflow.org/recommenders](https://www.tensorflow.org/recommenders).

There are several types of data that could be used for recommending movies:

- User interactions (selecting movies).
- User data.
- Movie data based on text embedding of movie titles.

The TensorFlow Recommenders approach uses a multi-tower architecture. The **query tower** processes user features and the **candidate tower** processes item features. During training, the model learns to bring the embeddings of users and their preferred items closer together in the embedding space.

While TensorFlow Recommenders is a Python library, the concepts apply to any language. In TypeScript, you could:

1. Use the TensorFlow.js equivalent APIs on Node.js for building embedding-based models.
2. Call a Python-based recommendation service via REST API.
3. Implement simpler collaborative filtering algorithms (like matrix factorization) directly in TypeScript.

### Simple Collaborative Filtering in TypeScript

Here is a sketch of a simple item-based collaborative filtering algorithm:

```typescript
// collaborative_filtering.ts

interface UserRatings {
  [userId: string]: { [itemId: string]: number };
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [key, valA] of a) {
    const valB = b.get(key);
    if (valB !== undefined) {
      dot += valA * valB;
    }
    normA += valA ** 2;
  }
  for (const [, valB] of b) {
    normB += valB ** 2;
  }
  return normA > 0 && normB > 0
    ? dot / (Math.sqrt(normA) * Math.sqrt(normB))
    : 0;
}

function recommend(
  ratings: UserRatings,
  targetUser: string,
  topN: number = 5
): string[] {
  const targetRatings = ratings[targetUser];
  if (!targetRatings) return [];

  const targetMap = new Map(Object.entries(targetRatings));
  const scores: Map<string, number> = new Map();

  // Find similar users
  for (const [userId, userRatings] of Object.entries(ratings)) {
    if (userId === targetUser) continue;
    const userMap = new Map(Object.entries(userRatings));
    const sim = cosineSimilarity(targetMap, userMap);

    if (sim > 0) {
      for (const [itemId, rating] of Object.entries(userRatings)) {
        if (!(itemId in targetRatings)) {
          scores.set(itemId,
            (scores.get(itemId) ?? 0) + sim * rating);
        }
      }
    }
  }

  return [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([item]) => item);
}
```

This is a simplified example that demonstrates the core concept: find users with similar rating patterns, then recommend items that similar users liked but the target user hasn't seen yet.


## Recommendation Systems Wrap-up

If you need to write a recommendation system for your work then I hope this short overview chapter will get you started. Here are alternative approaches and a few resources:

- Consider using [Amazon Personalize](https://aws.amazon.com/personalize/) which is a turn-key service on AWS.
- Consider using Google's turn-key [Recommendations AI](https://cloud.google.com/recommendations).
- For TypeScript-native solutions, implement matrix factorization or embedding-based approaches using TensorFlow.js on Node.js.
- A research idea: transform input training data to a textual representation for input to a Transformer model, based on the paper [Behavior Sequence Transformer for E-commerce Recommendation in Alibaba](https://arxiv.org/abs/1905.06874).

