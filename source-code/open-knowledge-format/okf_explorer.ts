import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ollama from "ollama";

// okf_explorer.ts — Open Knowledge Format (OKF) Bundle Explorer
//
// Demonstrates the OKF ideas from:
//   https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/
//   https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
//
// This script:
//   1. Loads an OKF knowledge bundle from disk (a directory tree of
//      Markdown files with YAML frontmatter).
//   2. Parses every concept document into a structured Concept object.
//   3. Builds a simple in-memory index (search by type, tag, text).
//   4. Uses Ollama (gemma4:e2b-it-qat) as the LLM "consumption agent" —
//      it receives the relevant concept bodies as context and answers
//      natural-language questions about the data assets.
//
// Run: npm start
//
// Requirements: ollama (npm dependency) + model pulled locally:
//   ollama pull gemma4:e2b-it-qat

// ---------------------------------------------------------------------------
// OKF data model
// ---------------------------------------------------------------------------

const RESERVED_FILENAMES = new Set(["index.md", "log.md"]);
const MODEL = "gemma4:e2b-it-qat";
const BUNDLE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "bundle"
);

type Frontmatter = Record<string, string | string[]>;

export class Concept {
  /** Relative path without the .md suffix. */
  conceptId: string;
  /** Absolute path to the file. */
  filePath: string;
  /** Parsed YAML frontmatter. */
  frontmatter: Frontmatter;
  /** Markdown body (everything after the frontmatter). */
  body: string;

  constructor(
    conceptId: string,
    filePath: string,
    frontmatter: Frontmatter,
    body: string
  ) {
    this.conceptId = conceptId;
    this.filePath = filePath;
    this.frontmatter = frontmatter;
    this.body = body;
  }

  // Convenience accessors from frontmatter
  get type(): string {
    const value = this.frontmatter.type;
    return typeof value === "string" ? value : "Unknown";
  }

  get title(): string {
    const value = this.frontmatter.title;
    return typeof value === "string" ? value : this.conceptId;
  }

  get description(): string {
    const value = this.frontmatter.description;
    return typeof value === "string" ? value : "";
  }

  get tags(): string[] {
    const value = this.frontmatter.tags;
    return Array.isArray(value) ? value : [];
  }

  asContextBlock(): string {
    const lines = [
      `## Concept: ${this.title}`,
      `**ID**: ${this.conceptId}`,
      `**Type**: ${this.type}`,
      `**Description**: ${this.description}`,
    ];
    if (this.tags.length > 0) {
      lines.push(`**Tags**: ${this.tags.join(", ")}`);
    }
    lines.push("");
    lines.push(this.body.trim());
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// OKF parser
// ---------------------------------------------------------------------------

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseSimpleYaml(yamlText: string): Frontmatter {
  /**
   * Minimal YAML parser for OKF frontmatter.
   *
   * Handles the subset used in this bundle:
   *   - key: scalar value
   *   - key: [item1, item2, ...]   (inline lists)
   * Does NOT require a YAML library so the example stays lightweight.
   * Upgrade to `import yaml from "yaml"; yaml.parse(...)` for production use.
   */
  const result: Frontmatter = {};
  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const key = line.slice(0, colonIndex).trim();
    let rest = line.slice(colonIndex + 1).trim();

    if (rest.startsWith("[") && rest.endsWith("]")) {
      const items = rest
        .slice(1, -1)
        .split(",")
        .map((item) => stripQuotes(item.trim()))
        .filter((item) => item.length > 0);
      result[key] = items;
    } else {
      result[key] = stripQuotes(rest);
    }
  }
  return result;
}

function parseConcept(filePath: string, bundleRoot: string): Concept | null {
  /**
   * Parse a single OKF concept document.
   *
   * Returns null for reserved filenames (index.md, log.md).
   */
  const fileName = path.basename(filePath);
  if (RESERVED_FILENAMES.has(fileName)) {
    return null;
  }

  const text = fs.readFileSync(filePath, "utf-8");

  // Extract YAML frontmatter delimited by ---
  let frontmatter: Frontmatter = {};
  let body = text;
  const fmMatch = text.match(/^---\s*\n(.*?)\n---\s*\n/s);
  if (fmMatch && fmMatch[1] !== undefined) {
    frontmatter = parseSimpleYaml(fmMatch[1]);
    body = text.slice(fmMatch[0].length);
  }

  // Concept ID = path relative to bundle root, without .md suffix
  let conceptId = path.relative(bundleRoot, filePath).replace(/\.md$/i, "");
  // Normalise Windows separators
  conceptId = conceptId.replace(/\\/g, "/");

  return new Concept(conceptId, filePath, frontmatter, body);
}

function walkMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// OKF bundle loader
// ---------------------------------------------------------------------------

export class KnowledgeBundle {
  /** An in-memory representation of an OKF knowledge bundle. */
  root: string;
  concepts: Concept[];

  constructor(root: string, concepts: Concept[]) {
    this.root = root;
    this.concepts = concepts;
  }

  static load(root: string): KnowledgeBundle {
    /** Recursively walk `root` and parse every concept document. */
    const concepts: Concept[] = [];
    for (const mdPath of walkMarkdownFiles(root)) {
      const concept = parseConcept(mdPath, root);
      if (concept !== null) {
        concepts.push(concept);
      }
    }
    concepts.sort((a, b) => a.filePath.localeCompare(b.filePath));
    return new KnowledgeBundle(root, concepts);
  }

  // ------------------------------------------------------------------
  // Search / index helpers
  // ------------------------------------------------------------------

  byType(conceptType: string): Concept[] {
    /** Return all concepts of a given type (case-insensitive). */
    const target = conceptType.toLowerCase();
    return this.concepts.filter((c) => c.type.toLowerCase() === target);
  }

  byTag(tag: string): Concept[] {
    /** Return all concepts that carry a given tag (case-insensitive). */
    const target = tag.toLowerCase();
    return this.concepts.filter((c) =>
      c.tags.some((t) => t.toLowerCase() === target)
    );
  }

  search(query: string): Concept[] {
    /**
     * Simple keyword search across title, description, and body text.
     * Returns concepts sorted by hit count (descending).
     */
    const keywords = query
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 2);

    const scored: Array<{ score: number; concept: Concept }> = [];
    for (const concept of this.concepts) {
      const haystack = (
        concept.title +
        " " +
        concept.description +
        " " +
        concept.body
      ).toLowerCase();
      const score = keywords.reduce((sum, kw) => sum + haystack.split(kw).length - 1, 0);
      if (score > 0) {
        scored.push({ score, concept });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.concept);
  }

  summary(): string {
    /** One-line summary of the bundle contents. */
    const typeCounts = new Map<string, number>();
    for (const c of this.concepts) {
      typeCounts.set(c.type, (typeCounts.get(c.type) ?? 0) + 1);
    }
    const counts = Array.from(typeCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => `${count}× ${type}`)
      .join(", ");
    return `${this.concepts.length} concepts (${counts})`;
  }
}

// ---------------------------------------------------------------------------
// LLM consumption agent
// ---------------------------------------------------------------------------

export class OKFAgent {
  /**
   * A simple 'consumption agent' that uses an Ollama LLM to answer
   * questions about the knowledge bundle.
   *
   * Following the OKF spec's vision of agents that can read and traverse
   * the bundle to surface curated insight.
   */

  static SYSTEM_PROMPT =
    `You are a data knowledge assistant. You have been given excerpts from
an Open Knowledge Format (OKF) knowledge bundle — a collection of
structured documentation about data tables, metrics, and operational
playbooks for a retail analytics platform.

Answer the user's question using ONLY the provided knowledge context.
Be concise, accurate, and cite the concept ID (e.g. tables/sales_events)
when referring to a specific asset. If the answer is not in the context,
say so clearly rather than guessing.`.replace(/^\s+/gm, "");

  bundle: KnowledgeBundle;
  model: string;

  constructor(bundle: KnowledgeBundle, model: string = MODEL) {
    this.bundle = bundle;
    this.model = model;
  }

  buildContext(query: string, topK: number = 4): string {
    /** Select the most relevant concepts and format them as context. */
    let relevant = this.bundle.search(query).slice(0, topK);
    if (relevant.length === 0) {
      relevant = this.bundle.concepts.slice(0, topK); // fallback: first N
    }
    const blocks = relevant.map((c) => c.asContextBlock());
    return blocks.join("\n\n---\n\n");
  }

  async ask(question: string): Promise<string> {
    /** Send a question to the LLM with relevant OKF context. */
    const context = this.buildContext(question);
    const userMessage = `## Knowledge Context\n\n${context}\n\n---\n\n## Question\n\n${question}`;

    const response = await ollama.chat({
      model: this.model,
      messages: [
        { role: "system", content: OKFAgent.SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    return response.message.content ?? "";
  }
}

// ---------------------------------------------------------------------------
// Demo / main
// ---------------------------------------------------------------------------

function printSection(title: string): void {
  const width = 70;
  console.log("\n" + "=".repeat(width));
  console.log(`  ${title}`);
  console.log("=".repeat(width));
}

async function main(): Promise<void> {
  // 1. Load the OKF bundle ------------------------------------------------
  printSection("Loading OKF Knowledge Bundle");
  const bundle = KnowledgeBundle.load(BUNDLE_DIR);
  console.log(`Bundle root : ${BUNDLE_DIR}`);
  console.log(`Contents    : ${bundle.summary()}`);

  // 2. Show all concept IDs and types ------------------------------------
  printSection("All Concepts in Bundle");
  for (const c of bundle.concepts) {
    console.log(`  [${c.type.padEnd(18)}]  ${c.conceptId}`);
    if (c.description) {
      console.log(`  ${" ".repeat(20)}  ${c.description.slice(0, 72)}`);
    }
  }

  // 3. Demonstrate index / search ----------------------------------------
  printSection("Search: 'revenue'");
  for (const c of bundle.search("revenue").slice(0, 3)) {
    console.log(`  ${c.conceptId}  —  ${c.description.slice(0, 60)}`);
  }

  printSection("Filter by type: 'Metric'");
  for (const c of bundle.byType("Metric")) {
    console.log(`  ${c.conceptId}  —  ${c.title}`);
  }

  printSection("Filter by tag: 'KPI'");
  for (const c of bundle.byTag("KPI")) {
    console.log(`  ${c.conceptId}  —  ${c.title}`);
  }

  // 4. LLM Q&A over the knowledge bundle ---------------------------------
  printSection(`LLM Q&A  (model: ${MODEL})`);

  const agent = new OKFAgent(bundle);

  const questions = [
    "How is daily revenue calculated and what tables does it use?",
    "What should I do if daily revenue drops suddenly?",
    "What percentage of sales events have a customer ID? " +
      "And what does that tell us about LTV calculations?",
    "How do I join sales_events to products correctly for historical reports?",
  ];

  for (const [i, q] of questions.entries()) {
    console.log(`\nQ${i + 1}: ${q}`);
    console.log("-".repeat(60));
    const answer = await agent.ask(q);
    console.log(answer);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  if (!fs.existsSync(BUNDLE_DIR)) {
    process.stderr.write(
      `ERROR: Bundle directory not found: ${BUNDLE_DIR}\n` +
        "Make sure you run this script from the open-knowledge-format/ directory.\n"
    );
    process.exit(1);
  }

  await main();
}
