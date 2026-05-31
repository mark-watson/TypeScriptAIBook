import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractKeywords } from "./keywords.js";
import { CacheEngine } from "./cache_engine.js";

// ── keywords.ts ────────────────────────────────────────────────────────

describe("extractKeywords", () => {
  it("extracts meaningful words and drops stop words", () => {
    assert.deepEqual(extractKeywords("the cat in the hat"), ["cat", "hat"]);
  });

  it("strips leading/trailing punctuation", () => {
    assert.deepEqual(extractKeywords("hello, world! 'test'"), ["hello", "world", "test"]);
  });

  it("filters short tokens (<=2 chars)", () => {
    assert.deepEqual(extractKeywords("a an the is ok hi"), []);
  });

  it("returns empty array for stop-word-only input", () => {
    assert.deepEqual(extractKeywords("the and of to"), []);
  });

  it("deduplicates repeated keywords", () => {
    assert.deepEqual(extractKeywords("code code code"), ["code"]);
  });

  it("handles mixed case", () => {
    assert.deepEqual(extractKeywords("The Quick Brown Fox"), ["quick", "brown", "fox"]);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(extractKeywords(""), []);
  });
});

// ── cache_engine.ts ────────────────────────────────────────────────────

describe("CacheEngine", () => {
  const dbPath = join(tmpdir(), `test-cache-${Date.now()}.db`);
  let cache: CacheEngine;

  before(() => {
    cache = new CacheEngine(dbPath);
  });

  after(() => {
    cache.close();
    try { unlinkSync(dbPath); } catch { /* ignore */ }
  });

  it("starts empty", () => {
    assert.equal(cache.count(), 0);
  });

  it("adds entries and increments count", () => {
    cache.add("TypeScript is great for building CLI tools");
    assert.equal(cache.count(), 1);
  });

  it("lookup finds entries by exact keyword token", () => {
    cache.add("Python is also a good language");
    const results = cache.lookup(["TypeScript"]);
    assert.equal(results.length, 1);
    assert.ok(results[0]!.includes("TypeScript"));
  });

  it("lookup does NOT match substrings", () => {
    // "Type" should NOT match "TypeScript" with token-level matching
    const results = cache.lookup(["Type"]);
    assert.equal(results.length, 0);
  });

  it("lookup returns most recent first", () => {
    cache.add("JavaScript frameworks are popular");
    cache.add("TypeScript adds static typing");
    const results = cache.lookup(["TypeScript"]);
    assert.equal(results.length, 2);
    // Most recent added last, so it should be first in results
    assert.equal(results[0], "TypeScript adds static typing");
    assert.equal(results[1], "TypeScript is great for building CLI tools");
  });

  it("lookup respects limit", () => {
    const results = cache.lookup(["TypeScript"], 1);
    assert.equal(results.length, 1);
  });

  it("deduplicates identical content", () => {
    const before = cache.count();
    cache.add("TypeScript adds static typing"); // already added above
    assert.equal(cache.count(), before);
  });

  it("clearOlderThanOneWeek removes old entries", () => {
    // Manually inject an expired entry via the file
    const expired = [{ content: "old data", createdAt: 0 }];
    writeFileSync(dbPath, JSON.stringify(expired));
    const c2 = new CacheEngine(dbPath);
    assert.equal(c2.count(), 1);
    const removed = c2.clearOlderThanOneWeek();
    assert.equal(removed, 1);
    assert.equal(c2.count(), 0);
    c2.close();
  });

  it("handles corrupt cache file gracefully", () => {
    writeFileSync(dbPath, "not valid json");
    const c3 = new CacheEngine(dbPath);
    assert.equal(c3.count(), 0);
    c3.close();
  });
});
