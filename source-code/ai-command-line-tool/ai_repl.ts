// ai_repl.ts — Interactive Gemini REPL with search grounding and persistent cache
// Copyright 2022-2026 Mark Watson. All rights reserved.
//
// Commands:
//   <text>   Ask Gemini       !<text>  Ask with Google Search
//   >        Cache last answer !       Clear old cache entries
//   h/help   Show help         q/quit  Exit

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { join } from "node:path";
import { homedir } from "node:os";
import { GoogleGenAI } from "@google/genai";
import { CacheEngine } from "./cache_engine.js";
import { extractKeywords } from "./keywords.js";

const MODEL = "gemini-2.5-flash";
const CACHE_DB_PATH = join(homedir(), ".ai-repl-cache.db");

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Error: Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });
const cache = new CacheEngine(CACHE_DB_PATH);
let lastAnswer: string | null = null;

function buildContext(query: string): string {
  const kw = extractKeywords(query);
  if (!kw.length) return "";
  const items = cache.lookup(kw, 10);
  if (!items.length) return "";
  return "Use the following context from previous conversations when answering:\n\n" +
    items.map(i => `- ${i}`).join("\n") + "\n\n---\n\n";
}

async function askGemini(prompt: string, search: boolean): Promise<string> {
  try {
    const config: Record<string, unknown> = {};
    if (search) config.tools = [{ googleSearch: {} }];
    const r = await ai.models.generateContent({ model: MODEL, contents: buildContext(prompt) + prompt, config });
    return r.text ?? "[No response from Gemini]";
  } catch (e) { return `[Error: ${e instanceof Error ? e.message : e}]`; }
}

function showAnswer(text: string) { console.log("\n" + text + "\n"); lastAnswer = text; }

async function replLoop() {
  const rl = readline.createInterface({ input, output });
  console.log("\n  Gemini AI REPL  (type 'h' for help)\n");

  try {
    while (true) {
      let line: string;
      try { line = await rl.question("gemini> "); } catch { console.log("\nGoodbye."); break; }
      const t = line.trim();
      if (!t) continue;
      if (["q", "quit", "exit"].includes(t.toLowerCase())) { console.log("Goodbye."); break; }

      if (["h", "help"].includes(t.toLowerCase())) {
        console.log(`\n  <text>  Ask Gemini    !<text> Ask + Search\n  >      Cache answer  !      Clear old cache\n  h      Help          q      Quit\n  Model: ${MODEL}  Cache: ${CACHE_DB_PATH} (${cache.count()} items)\n`);
        continue;
      }

      if (t === ">") {
        lastAnswer ? (cache.add(lastAnswer), console.log(`  [Cached. ${cache.count()} items]`)) : console.log("  [No answer yet]");
        continue;
      }

      if (t === "!" || (t.startsWith("!") && !t.slice(1).trim())) {
        const b = cache.count(); cache.clearOlderThanOneWeek();
        console.log(`  [Cleared ${b - cache.count()} old entries. ${cache.count()} remain]`);
        continue;
      }

      if (t.startsWith("!")) {
        console.log("  [Searching...]");
        showAnswer(await askGemini(t.slice(1).trim(), true));
      } else {
        console.log("  [Thinking...]");
        showAnswer(await askGemini(t, false));
      }
    }
  } finally { rl.close(); cache.close(); console.log("  [Cache closed]"); }
}

replLoop();
