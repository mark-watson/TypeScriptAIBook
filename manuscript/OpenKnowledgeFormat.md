# Open Knowledge Format (OKF) Bundle Explorer

Dear reader, have you ever felt that modern data governance is a bit too heavy-handed? We build rigid schemas, complex API registries, and massive data catalogs, only to find that our AI agents and human teammates struggle to get a cohesive, high-level picture of how everything fits together. 

This is where the **Open Knowledge Format (OKF)** comes in. OKF is a lightweight, human, and agent friendly convention for representing knowledge including the metadata, context, and curated insights surrounding data and systems. Rather than defining a rigid database schema, OKF organizes concepts as simple Markdown files with YAML frontmatter inside a git-compatible folder structure. This makes it incredibly easy to track in source control, edit by hand, and consume with LLM-based agents.

In this chapter, we will build a TypeScript implementation of an OKF "consumption agent". We'll parse a local OKF bundle, index its documents in memory, and query a local LLM via Ollama to answer questions about retail analytics datasets and procedures.

The examples for this chapter are in the directory **source-code/open-knowledge-format**.

## Inspiration and the Specification

Before we write code, let's look at where these ideas come from. Google has proposed the Open Knowledge Format as a way to improve data sharing across teams and organizations. The specification aims to bridge the gap between technical data resources (like tables in a database) and the business contexts (like key metrics, definitions, and operational playbooks) that make those resources valuable.

Specifically, we want to capture:
1. **Tables**: Physical data assets (e.g., in a database or data warehouse).
2. **Metrics**: Formulations and definitions of business KPIs.
3. **Playbooks**: Manuals or guides that tell analysts what to do when something goes wrong.

The specification suggests organizing these files in a simple directory hierarchy where each markdown document has standard YAML frontmatter to hold structured attributes (`type`, `tags`, `title`, `description`, etc.) and a Markdown body for human-friendly descriptions.

This implementation is based on the concepts and drafts defined by Google:
* **Concept Blog Post:** [How the Open Knowledge Format can improve data sharing](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/)
* **Format Specification:** [Google Cloud Platform Knowledge Catalog - OKF Specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)

*Note: This is a clean-room implementation of the OKF conceptual specification and does not use Google's proprietary libraries.*


## The Knowledge Bundle Structure

In our project, we have a sample knowledge bundle representing a retail analytics platform under the `bundle/` directory:

```text
bundle/
├── index.md                      # Bundle root index / table of contents
├── tables/
│   ├── sales_events.md          # Raw transaction data catalog
│   ├── products.md              # Canonical product dimension
│   └── customers.md             # Privacy-safe customer dimension
├── metrics/
│   ├── daily_revenue.md         # Revenue metric formula
│   └── customer_ltv.md          # LTV predictive model definition
└── playbooks/
    └── revenue_drop_investigation.md # Operational guide for incident management
```

Let's look at one of these concept files, dear reader, to see how clean and legible it is. Here is `bundle/tables/sales_events.md` (partial listing only for brevity, read through the files in bundle/ directory):

```yaml
---
type: Database Table
title: Sales Events
description: Raw point-of-sale event stream capturing every transaction at the register level.
resource: postgres://retail-db/analytics/sales_events
tags: [sales, transactions, raw, events]
timestamp: 2026-06-01T09:00:00Z
owner: data-engineering@example.com
row_count_estimate: 2_500_000_000
update_frequency: real-time (CDC)
---

# Sales Events

The `sales_events` table is the **source of truth** for all transactional data
in the retail analytics platform. Every scan at a point-of-sale terminal writes
a record here within seconds via Change Data Capture.

...
```

Notice how easy this is to read! A human can view it in a terminal or edit it in VS Code, git tracks every change, and, as we'll see next, it is perfectly set up for programmatic parsing.


## Defining the OKF Data Model

Let's start by modeling a single document in TypeScript. We define a `Concept` class to represent each file, holding its identifier, parsed frontmatter, and Markdown body.

Here is the implementation in `okf_explorer.ts`:

```typescript
// okf_explorer.ts, The Concept model and metadata mapping

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ollama from "ollama";

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
```

To keep our implementation lightweight and self-contained, dear reader, I have written a simple YAML frontmatter parser. It doesn't support the entire, massive YAML specification, but it handles scalars and inline arrays (like `[foo, bar]`) perfectly for our metadata needs.

```typescript
// okf_explorer.ts, Minimal YAML parser and file system walker for OKF concept parsing

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
```


## Implementing the Knowledge Bundle

Next, we implement the `KnowledgeBundle` class, which manages loading all files recursively and provides basic filtering and keyword search logic. Since we are working in memory, a simple keyword search scoring mechanism is more than fast enough for typical bundles.

```typescript
// okf_explorer.ts, In-memory KnowledgeBundle representation and keyword search indexing

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
```

---

## Building the Consumption Agent

The `OKFAgent` acts as our consumption agent. When asked a question, it queries the `KnowledgeBundle` using our simple keyword search, formats the top results as structured Markdown context blocks, and passes them to a local LLM via Ollama using a system prompt that enforces citing the source concept IDs.

```typescript
// okf_explorer.ts, OKFAgent using Ollama for context-augmented Q&A

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
an Open Knowledge Format (OKF) knowledge bundle, a collection of
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
```


## Tying It All Together

Now, let's tie everything together in our `main` entry point. The script will load the bundle, display a summary and index of the files, demonstrate our filter and search methods, and finally send a few queries to our `OKFAgent` using Ollama.

```typescript
// okf_explorer.ts, Driver program running the OKF bundle exploration and LLM query loop

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
```


## Running the Explorer and Sample Output

Let's see what the output looks like. If you run `npm start` with Ollama active, you will see a detailed trace. Here is an example of what our agent prints for some of the questions:

### Q1: How is daily revenue calculated and what tables does it use?
```text
Daily revenue is calculated by summing the product of quantity, unit_price_usd, and (1 - discount_pct / 100) from the sales_events table, excluding returns (where quantity <= 0). It is grouped by the event date and store_id.
Source concept: metrics/daily_revenue, which depends on the tables/sales_events table.
```

### Q2: What should I do if daily revenue drops suddenly?
```text
If daily revenue drops suddenly (decline > 10% day-over-day or > 2 standard deviations below the 30-day rolling average), you should follow the playbooks/revenue_drop_investigation playbook:
1. Confirm the drop is real (check pipeline run logs and verify row counts in tables/sales_events).
2. Isolate the drop by dimension (Store, Category, Payment method, or Hour of day).
3. Check for external signals (POS outages, weather, calendar events, promotions).
4. Escalate to the appropriate team if needed (e.g., #data-engineering-oncall).
```

### Q3: What percentage of sales events have a customer ID? And what does that tell us about LTV calculations?
```text
According to tables/sales_events, customer_id is NULL for roughly 38% of transactions (anonymous cash sales), meaning only about 62% of sales events have a customer ID.
According to metrics/customer_ltv, this anonymous transaction rate represents a key limitation, as LTV calculations are only calculated for registered customers and may underestimate total value or bias results toward credit/debit card users.
```

Isn't that neat, dear reader? Because the agent gets the raw text from the playbook and table schemas, it is able to synthesize an answer that connects the data-engineering details (e.g., NULL rates in `sales_events`) with the operational playbook guidance and metrics.

## Summary and Future Improvements

OKF is a useful tool because it fits into existing developer workflows. Instead of checking a web portal or wiki, you update markdown files in git. This means your documentation, metrics definitions, and playbooks are versioned right alongside your code. Furthermore, as we have shown, it is trivial to load these documents as context into a local LLM, turning static documentation into an interactive, context-aware AI data analyst.

If you want to take this example further in your own projects, dear reader, I recommend swapping our simple keyword-based `search()` method for a semantic vector search using embeddings (as we explored in the earlier local model chapters). This would let your agent locate concepts that share meaning even if they don't share exact matching words!

Here are two suggested projects for you, dear reader, to further experiment with OKF:

- **Project 1: Automatic OKF Generators.** Write a Python pipeline script that inspects a SQLite, PostgreSQL or BigQuery schema, extracts the column names and comments, and automatically generates or updates the frontmatter and schema tables in `bundle/tables/<table_name>.md`.
- **Project 2: Vector Search for OKF Bundles.** Replace the simple substring-matching index in `KnowledgeBundle.search()` with a vector database. Write a script to generate text embeddings for each concept using an Ollama embedding model (like `nomic-embed-text`) and perform semantic retrieval instead of keyword search.

## Optional Practice Problems

Here are some practice problems to help you test and expand your understanding of the Open Knowledge Format (OKF) Bundle Explorer:

- **Problem 1: Dynamic Schema Validation.** The current simple YAML parser does not validate the frontmatter fields. Enhance the `Concept` class (or write a separate validator using a library like Zod) to verify that concepts of a specific type contain required fields (e.g., ensuring `Database Table` concepts have a `resource` field and `Metric` concepts have a `tags` array).
- **Problem 2: Bundle Integrity and Reference Validator.** Create a tool that validates the consistency of the bundle. It should read `bundle/index.md`, confirm that all referenced markdown files actually exist, and check if concept markdown bodies contain broken relative links or mention missing concepts.
- **Problem 3: Concept Dependency Graph.** Analyze the concept bodies and frontmatter to discover relationships (e.g., playbooks referencing metrics, or metrics referencing tables). Write a function `generateDependencyGraph()` that extracts these connections and outputs a dynamic Mermaid graph representation of the bundle.
- **Problem 4: Interactive CLI Explorer.** The current driver script runs a predefined array of queries. Modify the script to run an interactive terminal loop (using Node's `readline` module) allowing you to search by keyword, view concept details, or ask the agent custom questions dynamically.


