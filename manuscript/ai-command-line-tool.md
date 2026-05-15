# An AI Command-Line Tool with Search Grounding and Persistent Cache

In this chapter we build an interactive command-line tool that combines Google's Gemini API with optional search grounding and a persistent cache. The result is a practical daily-driver REPL: you can ask Gemini questions, ground answers in live web search results, and selectively cache useful responses so they become context for future queries. The project uses only the **@google/genai** SDK and Node.js built-in modules — no native dependencies are required.

The examples for this chapter are in the directory **source-code/ai-command-line-tool**.

## How It Works

The AI REPL implements a simple but effective workflow:

1. **Ask a question** — Type a natural language query and Gemini responds using its training data plus any relevant cached context.
2. **Ask with search** — Prefix your query with `!` to enable Google Search grounding, useful for current events or factual lookups.
3. **Cache useful answers** — Type `>` to save the last answer to a persistent JSON cache file. When you ask a new question, the tool extracts keywords from your query and retrieves only cached entries that share keyword overlap — so only relevant context is included.
4. **Manage the cache** — Type `!` alone to clear cache entries older than one week.

This cache-as-context pattern is a lightweight alternative to retrieval-augmented generation (RAG). Instead of embedding documents into a vector store, you manually curate a set of useful facts. At query time, bag-of-words matching retrieves only the cached entries relevant to your current question, keeping context focused and avoiding noise.

## Prerequisites

You need Node.js (v20+) with npm and a `GOOGLE_API_KEY` environment variable set for the Gemini API. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Project Structure

The project consists of three TypeScript files with no external dependencies beyond `@google/genai` and the Node.js standard library:

```
ai-command-line-tool/
├── package.json
├── ai_repl.ts          // Main REPL application
├── cache_engine.ts     // JSON-file persistent cache
├── keywords.ts         // Keyword extraction with stop-word filtering
└── README.md
```

## Keyword Extraction

Before we can do relevance-based cache lookups, we need a way to extract meaningful keywords from the user's query. The `extractKeywords` function splits text into words, strips punctuation and stop words, and returns an array of content-bearing terms:

```typescript
// keywords.ts — Keyword extraction with stop-word filtering

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should",
  "may", "might", "must", "can", "could", "am", "it", "its",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
  "and", "or", "but", "not", "no", "nor", "so", "yet",
  "this", "that", "these", "those", "what", "which", "who", "whom",
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "they", "them",
  "how", "when", "where", "why", "if", "then", "than", "about",
]);

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[?!.,;:'"()]+|[?!.,;:'"()]+$/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
```

For example, the query `"What sci-fi movies are playing today in Flagstaff AZ?"` produces the keyword array `["sci-fi", "movies", "playing", "today", "flagstaff"]`. Words shorter than three characters, punctuation, and common stop words are all filtered out.

The `Set` data structure gives O(1) lookup time for stop words — a small detail that matters when you call this function on every query.

## The Cache Engine

The cache engine stores text entries as a JSON file in the user's home directory. Each entry carries a timestamp so old entries can be expired:

```typescript
// cache_engine.ts — JSON-file-backed persistent cache with keyword lookup

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  content: string;
  createdAt: number;
}

export class CacheEngine {
  private entries: CacheEntry[];
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      this.entries = JSON.parse(raw) as CacheEntry[];
    } else {
      this.entries = [];
    }
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  add(content: string): void {
    this.entries.push({ content, createdAt: Date.now() });
    this.save();
  }

  lookup(keywords: string[], limit: number = 10): string[] {
    if (keywords.length === 0) return [];
    const lowerKeywords = keywords.map((kw) => kw.toLowerCase());

    return this.entries
      .filter((entry) => {
        const lowerContent = entry.content.toLowerCase();
        return lowerKeywords.some((kw) => lowerContent.includes(kw));
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((entry) => entry.content);
  }

  count(): number {
    return this.entries.length;
  }

  clearOlderThanOneWeek(): number {
    const cutoff = Date.now() - ONE_WEEK_MS;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.createdAt >= cutoff);
    this.save();
    return before - this.entries.length;
  }

  close(): void {
    this.save();
  }
}
```

The `lookup` method implements bag-of-words matching: a cached entry is included if its text contains *any* of the query keywords. This OR-matching approach ensures that if you cached a movie-related answer last week and now ask about movies again, that context surfaces. But if you ask about something unrelated — say, a recipe — the movie answer stays out of the prompt.

Using a JSON file rather than SQLite keeps the project dependency-free and makes the cache trivially inspectable — you can open `~/.ai-repl-cache.json` in any text editor to review or edit your cached entries.

## The Main REPL Application

### Imports and Configuration

The application imports from Node.js standard library modules and the two local modules:

```typescript
// ai_repl.ts — Interactive Gemini REPL with search grounding and cache

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join } from "node:path";
import { homedir } from "node:os";
import { GoogleGenAI } from "@google/genai";
import { CacheEngine } from "./cache_engine.js";
import { extractKeywords } from "./keywords.js";

const MODEL = "gemini-2.5-flash";
const CACHE_DB_PATH = join(homedir(), ".ai-repl-cache.json");
```

The model is set to `gemini-2.5-flash` for fast, capable responses suitable for interactive use. The cache file lives in the user's home directory so it persists across sessions and working directories.

Note the `.js` extension in the import paths — this is required for ES module resolution in TypeScript. The `tsx` runner resolves `.js` imports to their `.ts` source files automatically.

### API Key Validation

Before doing anything else, we verify the API key is present:

```typescript
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("Error: GOOGLE_API_KEY environment variable is not set.");
  console.error("Export it before running:  export GOOGLE_API_KEY=your-key");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
```

This early check prevents a confusing error deep inside the API call. Small touches like this make command-line tools pleasant to use.

### Cache Context Builder

The `buildContextFromCache` function uses keyword extraction to retrieve only relevant cached entries and format them as a context preamble:

```typescript
const cache = new CacheEngine(CACHE_DB_PATH);
let lastAnswer: string | null = null;

function buildContextFromCache(query: string): string {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return "";

  const items = cache.lookup(keywords, 10);
  if (items.length === 0) return "";

  const bullets = items.map((item) => `- ${item}`).join("\n");
  return (
    "Use the following context from previous conversations " +
    "when answering:\n\n" +
    bullets +
    "\n\n---\n\n"
  );
}
```

When relevant cached items are found, the function produces a context preamble like:

```text
Use the following context from previous conversations when answering:

- Project Hail Mary is playing at Harkins Flagstaff 16.

---

```

This preamble is prepended to the prompt so Gemini can reference previously cached facts without the user repeating them.

### Query Dispatch

The `askGemini` function handles both plain and search-grounded queries:

```typescript
async function askGemini(
  prompt: string,
  searchGrounding: boolean,
): Promise<string> {
  const context = buildContextFromCache(prompt);
  const fullPrompt = context + prompt;

  try {
    const config: Record<string, unknown> = {};
    if (searchGrounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: fullPrompt,
      config,
    });

    return response.text ?? "[No response from Gemini]";
  } catch (error) {
    return `[Error calling Gemini API: ${
      error instanceof Error ? error.message : error
    }]`;
  }
}
```

The `try/catch` wrapping is important for a daily-use tool — network errors, rate limits, and API issues should produce a readable message rather than crashing the REPL.

The `tools: [{ googleSearch: {} }]` config enables Google Search grounding through the Gemini API. When active, Gemini searches the web for current information before generating its response, making it useful for questions about current events or facts that may have changed since the model's training cutoff.

### The REPL Loop

The heart of the application is `replLoop`, which uses Node.js `readline/promises` for interactive input:

```typescript
async function replLoop(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  console.log("\n  Gemini AI REPL  (type 'h' for help)\n");

  try {
    while (true) {
      let line: string;
      try {
        line = await rl.question("gemini> ");
      } catch {
        // EOF (Ctrl-D)
        console.log("\nGoodbye.");
        break;
      }

      const trimmed = line.trim();

      if (trimmed === "") continue;

      if (["q", "quit", "exit"].includes(trimmed.toLowerCase())) {
        console.log("Goodbye.");
        break;
      }

      if (["h", "help"].includes(trimmed.toLowerCase())) {
        printHelp();
        continue;
      }

      // ">" — cache last answer
      if (trimmed === ">") {
        if (lastAnswer) {
          cache.add(lastAnswer);
          console.log(`  [Cached. ${cache.count()} items total]`);
        } else {
          console.log("  [No answer to cache yet]");
        }
        continue;
      }

      // "!" alone — clear old cache
      if (trimmed === "!") {
        const before = cache.count();
        cache.clearOlderThanOneWeek();
        const after = cache.count();
        console.log(
          `  [Cleared ${before - after} old entries. ${after} items remain]`,
        );
        continue;
      }

      // "!<query>" — search-grounded question
      if (trimmed.startsWith("!")) {
        const query = trimmed.slice(1).trim();
        if (query !== "") {
          console.log("  [Searching...]");
          const answer = await askGemini(query, true);
          displayAnswer(answer);
        }
        continue;
      }

      // Plain question
      console.log("  [Thinking...]");
      const answer = await askGemini(trimmed, false);
      displayAnswer(answer);
    }
  } finally {
    rl.close();
    cache.close();
    console.log("  [Cache closed]");
  }
}
```

The command dispatch is worth studying. The `!` character serves double duty: alone it clears old cache entries, but followed by text it triggers a search-grounded query. The `if (trimmed === "!")` check before `if (trimmed.startsWith("!"))` ensures the two cases are handled separately.

The `try/finally` block mirrors the Common Lisp `unwind-protect` pattern — the cache file is flushed to disk even if the user exits with Ctrl-D or an unhandled error occurs.

Using `readline/promises` with `await` gives us a clean loop structure without the callback nesting that the traditional `readline` API would require. The `try/catch` around `rl.question` handles EOF (Ctrl-D) gracefully.


## Running the Tool

Install dependencies and start the REPL:

```bash
cd source-code/ai-command-line-tool
npm install
export GOOGLE_API_KEY=your-key-here
npx tsx ai_repl.ts
```

## Example Session

The following session demonstrates the search-then-cache workflow. First we ask a question with Google Search grounding (prefix `!`), then cache the answer, then ask the same question without search — Gemini can now answer from the cached context:

```text
$ npx tsx ai_repl.ts

  Gemini AI REPL  (type 'h' for help)

gemini> h

  Gemini AI REPL
  ─────────────────────────────────────────
  <text>         Ask Gemini a question
  !<text>        Ask with Google Search grounding
  >              Add last answer to cache
  !              Clear cache entries older than 1 week
  h / help       Show this help
  q / quit       Exit
  Ctrl-D         Exit
  ─────────────────────────────────────────
  Model: gemini-2.5-flash
  Cache: /Users/you/.ai-repl-cache.json (0 items)

gemini> !what sci-fi movies are playing today in Flagstaff AZ?
  [Searching...]

For today, the following science fiction movie is playing in Flagstaff, AZ:

*   **Project Hail Mary** (PG-13) is showing at the **Harkins Flagstaff 16**.

Please check the Harkins Theatres website or your preferred ticketing
platform to confirm specific showtimes.

gemini> >
  [Cached. 1 items total]
gemini> what sci-fi movies are playing today in Flagstaff AZ?
  [Thinking...]

For today, the science fiction movie **Project Hail Mary** (PG-13) is
playing at the **Harkins Flagstaff 16**.

Please check the Harkins Theatres website to confirm specific showtimes.
```

Notice that the second query (without the `!` prefix) produces the same accurate, current answer — even though it did not use Google Search. The keywords `"sci-fi"`, `"movies"`, `"flagstaff"` matched the cached answer, so it was automatically included as context for Gemini.

## REPL Command Reference

| Input | Action |
|-------|--------|
| `<text>` | Ask Gemini a question |
| `!<text>` | Ask with Google Search grounding |
| `>` | Add last answer to persistent cache |
| `!` | Clear cache entries older than 1 week |
| `h` / `help` | Show help |
| `q` / `quit` | Exit |
| `Ctrl-D` | Exit |

## Key Takeaways

1. **Cache as context with relevance filtering** — Selectively caching LLM responses and using bag-of-words keyword matching to retrieve only relevant entries keeps prompts focused. This is a lightweight alternative to vector-based RAG that works well for a personal tool.
2. **Search grounding** — The `tools: [{ googleSearch: {} }]` config leverages Google Search through the Gemini API, making the tool useful for current events and factual queries that exceed the model's training cutoff.
3. **Node.js readline/promises** — The promise-based readline API provides line editing, history, and Ctrl-D handling out of the box, making the REPL feel like a native shell tool without any third-party dependencies.
4. **try/finally for cleanup** — Wrapping the REPL loop ensures the cache file is flushed to disk, even on unexpected exits. This is the TypeScript equivalent of Common Lisp's `unwind-protect`.
5. **Composing modules** — This tool demonstrates how small, focused TypeScript modules (Gemini client, cache engine, keyword extractor) compose cleanly into a practical application. Each module is independently testable and reusable.


