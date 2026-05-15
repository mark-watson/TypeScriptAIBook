// keywords.ts — Keyword extraction with stop-word filtering
// Copyright 2022-2026 Mark Watson. All rights reserved.

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

/**
 * Extracts meaningful keywords from text by splitting on whitespace,
 * lowercasing, removing punctuation, and filtering stop words and
 * short words (≤ 2 characters).
 *
 * Example:
 *   extractKeywords("What sci-fi movies are playing today in Flagstaff AZ?")
 *   // => ["sci-fi", "movies", "playing", "today", "flagstaff"]
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[?!.,;:'"()]+|[?!.,;:'"()]+$/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
