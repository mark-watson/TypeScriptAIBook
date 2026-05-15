// cache_engine.ts — JSON-file-backed persistent cache with keyword lookup
// Copyright 2022-2026 Mark Watson. All rights reserved.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry { content: string; createdAt: number }

/**
 * Persistent JSON-file cache with keyword-based retrieval.
 * Stores text entries with timestamps; supports bag-of-words
 * matching and automatic one-week expiry.
 */
export class CacheEngine {
  private entries: CacheEntry[];
  constructor(private filePath: string) {
    this.entries = existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf-8")) : [];
  }
  private save() { writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2)); }

  add(content: string) { this.entries.push({ content, createdAt: Date.now() }); this.save(); }

  lookup(keywords: string[], limit = 10): string[] {
    const lk = keywords.map(k => k.toLowerCase());
    return this.entries
      .filter(e => lk.some(k => e.content.toLowerCase().includes(k)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit).map(e => e.content);
  }

  count() { return this.entries.length; }

  clearOlderThanOneWeek(): number {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.createdAt >= Date.now() - ONE_WEEK_MS);
    this.save();
    return before - this.entries.length;
  }

  close() { this.save(); }
}
