# Practical TypeScript Artificial Intelligence Programming

Source code and manuscript for **Practical TypeScript Artificial Intelligence Programming** by Mark Watson.

Copyright 2026 Mark Watson. This book may be shared using the Creative Commons "share and share alike, no modifications, no commercial reuse" license. The example code is Apache 2 licensed.

This book covers a wide range of practical AI techniques in TypeScript, from classic machine learning and symbolic AI to modern deep learning and large language models. All examples are command-line programs that run on Node.js — no browser or UI framework required.

## Topics

- TypeScript development environment setup
- TypeScript tutorial for command-line AI programs
- Machine learning: classification, regression, clustering
- Exploratory data analysis and feature engineering
- Deep learning basics with TensorFlow.js
- NLP with Hugging Face Transformers.js
- Large Language Models: transformers, public APIs (Google Gemini, OpenAI), local models (Ollama)
- Reinforcement learning
- Recommendation systems
- Symbolic AI and knowledge representation (graph/relational databases, semantic web, linked data)

## Repository Structure

- **`manuscript/`** — Chapter markdown files and resources for the book
- **`source-code/`** — Example TypeScript programs for each chapter

## Getting the Book

The book is available on Leanpub: [leanpub.com/typescriptai](https://leanpub.com/typescriptai)

## Example Code

Each source-code subdirectory uses `npm` for dependency management. To run an example:

```bash
cd source-code/llm_public_apis
npm install
npx tsx gemini_text.ts
```

Some examples require API keys set as environment variables:
- `GOOGLE_API_KEY` — for Google Gemini API examples
- `OPENAI_API_KEY` — for OpenAI API examples
- `HF_TOKEN` — for Hugging Face Inference API examples

## About the Author

Mark Watson has written over 20 books, holds over 50 US patents, and has worked at Google, Capital One, SAIC, and others. Visit [markwatson.com](https://markwatson.com).
