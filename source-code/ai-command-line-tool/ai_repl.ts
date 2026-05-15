// ai_repl.ts — Interactive Gemini REPL with search grounding and persistent cache
// Copyright 2022-2026 Mark Watson. All rights reserved.
//
// Commands:
//   <text>          Ask Gemini a question (plain, no search)
//   !<text>         Ask Gemini with Google Search grounding
//   >               Add last answer to the persistent cache
//   !               Clear cache entries older than one week
//   h / help        Show help
//   q / quit / exit Exit the REPL
//   Ctrl-D          Exit the REPL

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join } from "node:path";
import { homedir } from "node:os";
import { GoogleGenAI } from "@google/genai";
import { CacheEngine } from "./cache_engine.js";
import { extractKeywords } from "./keywords.js";

// ---- Configuration ----

const MODEL = "gemini-2.5-flash";
const CACHE_DB_PATH = join(homedir(), ".ai-repl-cache.db");

// ---- Validate API key ----

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("Error: GOOGLE_API_KEY environment variable is not set.");
  console.error("Export it before running:  export GOOGLE_API_KEY=your-key-here");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// ---- State ----

const cache = new CacheEngine(CACHE_DB_PATH);
let lastAnswer: string | null = null;

// ---- Cache context builder ----

/**
 * Retrieves cached items relevant to the query using bag-of-words
 * keyword matching, then formats them as a context preamble.
 */
function buildContextFromCache(query: string): string {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return "";

  const items = cache.lookup(keywords, 10);
  if (items.length === 0) return "";

  const bullets = items.map((item) => `- ${item}`).join("\n");
  return (
    "Use the following context from previous conversations when answering:\n\n" +
    bullets +
    "\n\n---\n\n"
  );
}

// ---- Query dispatch ----

/**
 * Sends a prompt to Gemini, optionally with Google Search grounding.
 * Prepends relevant cached context to the prompt.
 */
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
    return `[Error calling Gemini API: ${error instanceof Error ? error.message : error}]`;
  }
}

// ---- Help text ----

function printHelp(): void {
  console.log();
  console.log("  Gemini AI REPL");
  console.log("  ─────────────────────────────────────────");
  console.log("  <text>         Ask Gemini a question");
  console.log("  !<text>        Ask with Google Search grounding");
  console.log("  >              Add last answer to cache");
  console.log("  !              Clear cache entries older than 1 week");
  console.log("  h / help       Show this help");
  console.log("  q / quit       Exit");
  console.log("  Ctrl-D         Exit");
  console.log("  ─────────────────────────────────────────");
  console.log(`  Model: ${MODEL}`);
  console.log(`  Cache: ${CACHE_DB_PATH} (${cache.count()} items)`);
  console.log();
}

// ---- Display answer ----

function displayAnswer(text: string): void {
  console.log();
  console.log(text);
  console.log();
  lastAnswer = text;
}

// ---- REPL loop ----

async function replLoop(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  console.log();
  console.log("  Gemini AI REPL  (type 'h' for help)");
  console.log();

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

      // Empty line — skip
      if (trimmed === "") continue;

      // Quit
      if (["q", "quit", "exit"].includes(trimmed.toLowerCase())) {
        console.log("Goodbye.");
        break;
      }

      // Help
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
        if (query === "") {
          // Edge case: "! " with only whitespace after the !
          const before = cache.count();
          cache.clearOlderThanOneWeek();
          const after = cache.count();
          console.log(
            `  [Cleared ${before - after} old entries. ${after} items remain]`,
          );
        } else {
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

// ---- Entry point ----

replLoop();
