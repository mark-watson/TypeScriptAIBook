// cache_engine.ts — JSON-file-backed persistent cache with keyword lookup
// Copyright 2022-2026 Mark Watson. All rights reserved.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  content: string;
  createdAt: number;
}

/**
 * A persistent JSON-file cache that stores text entries with timestamps.
 * Supports keyword-based retrieval (bag-of-words matching) and
 * automatic expiry of entries older than one week.
 *
 * Using a JSON file keeps this project dependency-free (no native
 * SQLite compilation required) and makes the cache trivially inspectable.
 */
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

  /** Persist the current entries to disk. */
  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  /** Add a text entry to the cache with the current timestamp. */
  add(content: string): void {
    this.entries.push({ content, createdAt: Date.now() });
    this.save();
  }

  /**
   * Look up cached entries that contain any of the given keywords.
   * Returns up to `limit` matching entries, most recent first.
   */
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

  /** Return the total number of cached entries. */
  count(): number {
    return this.entries.length;
  }

  /** Delete entries older than one week. Returns the number deleted. */
  clearOlderThanOneWeek(): number {
    const cutoff = Date.now() - ONE_WEEK_MS;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.createdAt >= cutoff);
    this.save();
    return before - this.entries.length;
  }

  /** Flush to disk (called at REPL exit for safety). */
  close(): void {
    this.save();
  }
}
