# AI Command-Line Tool — Example for Mark Watson's book "Practical Artificial Intelligence with TypeScript"

Book URI: https://leanpub.com/TypeScriptAI

An interactive Gemini REPL with Google Search grounding and a persistent SQLite cache for building LLM context over time.

## Setup

```bash
npm install
export GOOGLE_API_KEY="your-key"
```

## Run

```bash
npx tsx ai_repl.ts
```

## REPL Commands

| Input | Action |
|-------|--------|
| `<text>` | Ask Gemini a question |
| `!<text>` | Ask with Google Search grounding |
| `>` | Add last answer to persistent cache |
| `!` | Clear cache entries older than 1 week |
| `h` / `help` | Show help |
| `q` / `quit` | Exit |
| `Ctrl-D` | Exit |

## How It Works

- **Cache as context**: Cached entries relevant to your current query (matched by bag-of-words keyword overlap) are prepended to each prompt, giving Gemini targeted context from previous conversations.
- **Search grounding**: Prefix a query with `!` to enable Google Search, useful for current events or factual lookups.
- **Line editing**: Uses Node.js built-in readline for history and line editing.

## Book Cover Material, Copyright, and License

This example is released using the Apache 2 license.

Copyright 2022-2026 Mark Watson. All rights reserved.

## This Book is Licensed with Creative Commons Attribution CC BY Version 3
