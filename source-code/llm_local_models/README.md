# LLM Local Models Examples

Examples using Ollama for running local LLMs.

## Prerequisites

Install Ollama: `brew install ollama` then `ollama serve`

Pull models:
```bash
ollama pull llama3.2:3b
ollama pull deepseek-r1:7b   # for reasoning example
```

## Setup

```bash
npm install
```

## Run

```bash
npx tsx ollama_text.ts
npx tsx ollama_streaming.ts
npx tsx ollama_reasoning.ts
npx tsx ollama_memory.ts
npx tsx ollama_openai_compat.ts
```
