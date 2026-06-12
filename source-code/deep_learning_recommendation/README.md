# Deep Learning Recommendation System

Implements two recommendation algorithms from scratch in TypeScript:

1. **Embedding Matrix Factorization** — learns dense user/item embeddings via SGD
2. **Item-Based Collaborative Filtering** — uses adjusted cosine similarity

No external ML libraries required.

## Run

```bash
npm install
npx tsx recommendation_demo.ts     # Full demo with both models
npx tsx collaborative_filtering.ts  # Standalone collaborative filtering
```
