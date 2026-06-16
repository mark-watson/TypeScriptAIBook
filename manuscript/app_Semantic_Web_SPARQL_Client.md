# Querying the Semantic Web with SPARQL

The Semantic Web is one of the most ambitious ideas in the history of computing: a vision of the World Wide Web where data is not just readable by humans, but *understandable* by machines. Tim Berners-Lee originally proposed it in 2001 as an extension of the existing web, and while the full vision has not been realized in the way he imagined, parts of it have become remarkably successful. Two of the largest publicly accessible knowledge graphs in the world—DBPedia and Wikidata—expose billions of structured facts through a query language called SPARQL, and anyone can query them for free.

In this chapter, we will build a desktop SPARQL client using Tauri v2, Vite, and vanilla TypeScript. The application lets you select an endpoint (DBPedia or Wikidata), write a SPARQL query in a text area, and see the results rendered as a formatted table. Along the way, I will introduce you to the core Semantic Web concepts—RDF triples, knowledge graphs, and the SPARQL query language—and show you how surprisingly little code is needed to tap into these massive knowledge bases from a TypeScript application.

This project lives in the **semantic-web-app** directory and is directly inspired by the knowledge representation examples in my earlier TypeScript AI book. If you have worked through those examples, you will recognize the same patterns here, now wrapped in a native desktop UI.

## The Semantic Web in Brief

Before we look at code, let me give you a short tour of the ideas that make this application possible.

### RDF: The Data Model

The foundation of the Semantic Web is RDF (Resource Description Framework). RDF represents all knowledge as **triples**: statements of the form *subject–predicate–object*. For example:

```
<http://dbpedia.org/resource/Berlin>  <http://dbpedia.org/ontology/country>  <http://dbpedia.org/resource/Germany>
```

This triple says "Berlin's country is Germany." Every element is identified by a URI—a globally unique identifier, just like a web URL. This is what makes RDF powerful: any two datasets that refer to the same URI are automatically linked. You do not need a foreign key or a join table; the shared URI *is* the link.

A collection of RDF triples forms a **knowledge graph**—a directed graph where subjects and objects are nodes, and predicates are the labeled edges connecting them. Knowledge graphs are a natural fit for representing the kind of interconnected, heterogeneous knowledge that the real world contains.

### SPARQL: The Query Language

SPARQL (pronounced "sparkle") is the query language for RDF data. If RDF is the Semantic Web's equivalent of relational tables, SPARQL is its SQL. A SPARQL query uses **triple patterns** with variables (prefixed with `?`) to match against the knowledge graph:

```sparql
SELECT ?city ?population WHERE {
  ?city <http://dbpedia.org/ontology/type> <http://dbpedia.org/resource/City> .
  ?city <http://dbpedia.org/property/populationEst> ?population .
}
```

This query finds all entities typed as a City that have a population estimate, and returns them. The SPARQL engine matches these patterns against the triples in the database and returns all variable bindings that satisfy the constraints.

### Knowledge Graphs and AI

Knowledge graphs are a cornerstone of knowledge representation in AI. While modern large language models store knowledge implicitly in neural network weights, knowledge graphs store it *explicitly* as structured, queryable facts. This makes them valuable for applications where you need precise, verifiable answers—not probabilistic guesses. Many AI systems use knowledge graphs alongside neural models: the graph provides factual grounding, while the model provides natural language understanding.

DBPedia and Wikidata are two of the most important open knowledge graphs. DBPedia extracts structured data from Wikipedia infoboxes—those summary tables you see in the sidebar of Wikipedia articles. Wikidata is a collaboratively edited knowledge base maintained by the Wikimedia Foundation, and it serves as the structured data backbone for Wikipedia itself. Both expose SPARQL endpoints that anyone can query over HTTP.

## DBPedia vs. Wikidata

Our application supports both endpoints, and it is worth understanding how they differ:

**DBPedia** extracts its data automatically from Wikipedia. Its URIs look like `http://dbpedia.org/resource/Berlin`, which map directly to Wikipedia article titles. DBPedia uses familiar RDF Schema predicates like `rdfs:label` and its own ontology namespace (`dbo:`, `dbp:`). Queries tend to be straightforward because the property names are human-readable. The downside is that DBPedia's data can be inconsistent—it inherits whatever quirks exist in Wikipedia's infoboxes—and its SPARQL endpoint can sometimes be slow or unavailable.

**Wikidata** is a first-class, curated knowledge base. Its URIs use opaque identifiers like `wd:Q64` (which happens to be Berlin) and `wdt:P1082` (which means "population"). This makes the queries harder to read at first glance, but the data quality is generally higher, and the query service is fast and reliable. Wikidata also provides a powerful `SERVICE wikibase:label` clause that automatically resolves those opaque identifiers into human-readable labels, which is extremely convenient.

## Project Structure

Here is the layout of the **semantic-web-app** project:

```
semantic-web-app/
├── index.html            ← App shell: form with endpoint selector,
│                           query textarea, and results area
├── package.json          ← Tauri v2 + Vite dependencies
├── vite.config.ts        ← Vite dev server on port 1420 for Tauri
├── tsconfig.json
├── src/
│   ├── main.ts           ← SPARQL client: query execution, result
│   │                       formatting, URI shortening (190 lines)
│   └── styles.css        ← Light/dark theme with table styling
│                           (219 lines)
└── src-tauri/
    ├── tauri.conf.json   ← Tauri app config: window size, CSP,
    │                       build commands
    ├── Cargo.toml
    └── src/
        └── lib.rs        ← Minimal Rust backend (Tauri shell)
```

The architecture is simple by design. All the SPARQL logic lives in the frontend TypeScript—there are no Rust commands involved in querying. The Tauri shell provides the native window, and Vite handles the dev server and build pipeline. The `fetch` API makes HTTP requests directly to the SPARQL endpoints.

Let me note something about the Tauri configuration that matters for this application: the `security.csp` field is set to `null` in `tauri.conf.json`. This disables the Content Security Policy, which would otherwise block the cross-origin fetch requests to `dbpedia.org` and `wikidata.org`. In a production application, you would want to set a specific CSP that allows only those two origins. For a demo, disabling it keeps things simple.

## The SPARQL Client Implementation

Let us walk through the TypeScript code in `src/main.ts`. This file is 190 lines and contains everything: type definitions, endpoint configuration, the SPARQL query function, result formatting, and DOM event handling.

### Type Definitions

We start with TypeScript interfaces that model the SPARQL JSON results format. This is a standard format defined by the W3C—every SPARQL endpoint returns results in the same shape:

```typescript
type SparqlEndpoint = "dbpedia" | "wikidata";

interface SparqlValue {
  value: string;
  type: string;
  datatype?: string;
  "xml:lang"?: string;
}

interface SparqlBinding {
  [variable: string]: SparqlValue | undefined;
}

interface SparqlResults {
  head: {
    vars: string[];
  };
  results: {
    bindings: SparqlBinding[];
  };
}
```

The `SparqlEndpoint` type is a union of the two endpoint names we support. The `SparqlValue` interface represents a single value in a result row: it has a `value` string, a `type` (which is `"uri"`, `"literal"`, or `"typed-literal"`), and optional `datatype` and `xml:lang` fields for typed and language-tagged literals. The `SparqlBinding` interface is an index signature mapping variable names to their values—this models one row of results. Finally, `SparqlResults` wraps the whole response: `head.vars` lists the variable names (the column headers), and `results.bindings` is the array of rows.

I want to call your attention to the `undefined` in `SparqlBinding`. A binding can be missing for a given variable if that variable was matched in an `OPTIONAL` clause and no value was found. Our code needs to handle this gracefully, and you will see how `formatValue` does that shortly.

### Endpoint Configuration

Next, we define the SPARQL endpoints and their default queries:

```typescript
const ENDPOINTS: Record<SparqlEndpoint, { url: string; userAgent: string }> = {
  dbpedia: {
    url: "https://dbpedia.org/sparql",
    userAgent: "SemanticWebApp/1.0 (DBPedia demo)",
  },
  wikidata: {
    url: "https://query.wikidata.org/sparql",
    userAgent: "SemanticWebApp/1.0 (Wikidata demo)",
  },
};
```

Each endpoint has a URL and a custom User-Agent string. The User-Agent is important: both DBPedia and Wikidata require a meaningful User-Agent header. If you send the default browser User-Agent or an empty string, the endpoint may reject your request or rate-limit you aggressively. Setting a descriptive User-Agent is good practice and good citizenship when querying public SPARQL endpoints.

### Default Queries

The application ships with two default queries that demonstrate the capabilities of each endpoint. Let us look at them in detail.

**DBPedia: Cities by Population**

```typescript
const DEFAULT_QUERIES: Record<SparqlEndpoint, string> = {
  dbpedia: `SELECT ?city_uri ?dbpedia_label ?population ?country_label WHERE {
  ?city_uri <http://dbpedia.org/ontology/type> <http://dbpedia.org/resource/City> .
  ?city_uri <http://dbpedia.org/property/populationEst> ?population .
  ?city_uri <http://www.w3.org/2000/01/rdf-schema#label> ?dbpedia_label
    FILTER (lang(?dbpedia_label) = 'en') .
  OPTIONAL {
    ?city_uri <http://dbpedia.org/ontology/country> ?country .
    ?country <http://www.w3.org/2000/01/rdf-schema#label> ?country_label
      FILTER (lang(?country_label) = 'en') .
  }
} ORDER BY DESC(?population) LIMIT 10`,
```

This query demonstrates several SPARQL features:

- **Triple patterns**: The first line matches entities whose `dbo:type` is `dbr:City`. The second matches entities that have a `dbp:populationEst` property.
- **FILTER**: The `FILTER (lang(?dbpedia_label) = 'en')` clause restricts results to English-language labels. Without this, you would get labels in every language available in DBPedia—German, French, Japanese, and so on.
- **OPTIONAL**: The country lookup is wrapped in an `OPTIONAL` block. Not every city in DBPedia has a `dbo:country` link, so without `OPTIONAL` those cities would be excluded entirely. With it, they appear in the results with an empty country column.
- **ORDER BY DESC** and **LIMIT**: We sort by population descending and take only the top 10.

**Wikidata: Albert Einstein Facts**

```typescript
  wikidata: `SELECT ?personLabel ?birthPlaceLabel ?birthDate ?occupationLabel WHERE {
  ?person wdt:P31 wd:Q5 .
  ?person rdfs:label "Albert Einstein"@en .
  OPTIONAL { ?person wdt:P19 ?birthPlace . }
  OPTIONAL { ?person wdt:P569 ?birthDate . }
  OPTIONAL { ?person wdt:P106 ?occupation . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} LIMIT 10`,
};
```

This query shows Wikidata's style. The identifiers are opaque: `wdt:P31` means "instance of," `wd:Q5` means "human," `wdt:P19` is "place of birth," `wdt:P569` is "date of birth," and `wdt:P106` is "occupation." You learn these by browsing Wikidata or using its search interface.

The `SERVICE wikibase:label` clause is a Wikidata-specific extension. It is a **federated query** that calls a label-resolution service. When you include it, Wikidata automatically creates `*Label` versions of your variables (e.g., `?personLabel` from `?person`) that contain the human-readable English labels. Without this clause, you would see results like `wd:Q64` instead of "Berlin." The `SERVICE` keyword is part of the SPARQL standard for federated queries—queries that reach out to remote SPARQL endpoints during execution.

Notice that the Wikidata query returns multiple rows even though we are asking about a single person. This is because Einstein had multiple occupations (physicist, philosopher, professor, etc.), and each one produces a separate row in the results. This is a natural consequence of the triple-based data model: there are multiple `wdt:P106` triples for Einstein, each pointing to a different occupation entity.

### The Query Function

The core of the application is a single `async` function that sends a SPARQL query to an endpoint and returns the parsed JSON results:

```typescript
async function sparqlQuery(
  endpoint: SparqlEndpoint,
  query: string
): Promise<SparqlResults> {
  const config = ENDPOINTS[endpoint];
  const resp = await fetch(
    `${config.url}?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": config.userAgent,
      },
    }
  );
  if (!resp.ok) {
    throw new Error(
      `SPARQL query failed: ${resp.status} ${resp.statusText}`
    );
  }
  return resp.json();
}
```

This is pleasantly simple. The SPARQL protocol specifies that you can send a query as a URL parameter named `query`, URL-encoded, via an HTTP GET request. The `Accept: application/sparql-results+json` header tells the endpoint to return results in JSON format rather than XML or CSV. The function URL-encodes the query, sends it with the appropriate headers, checks for HTTP errors, and parses the JSON response.

I want to highlight that we are using the browser's built-in `fetch` API here. No SPARQL library, no RDF toolkit—just a plain HTTP request. SPARQL endpoints are designed to be accessed this way, and the JSON results format is simple enough that we can work with it directly using TypeScript interfaces. This is one of the beautiful things about the Semantic Web: the protocol is just HTTP, and the data format is just JSON.

### URI Shortening

Raw URIs in SPARQL results are verbose. The function `shortenUri` converts them into the compact prefix notation that SPARQL users are familiar with:

```typescript
function shortenUri(value: string): string {
  if (value.startsWith("http://dbpedia.org/resource/")) {
    return `dbr:${value.slice(28)}`;
  }
  if (value.startsWith("https://dbpedia.org/resource/")) {
    return `dbr:${value.slice(29)}`;
  }
  if (value.startsWith("http://dbpedia.org/ontology/")) {
    return `dbo:${value.slice(28)}`;
  }
  if (value.startsWith("http://dbpedia.org/property/")) {
    return `dbp:${value.slice(28)}`;
  }
  if (value.startsWith("http://www.wikidata.org/entity/")) {
    return `wd:${value.slice(31)}`;
  }
  if (value.startsWith("http://www.wikidata.org/prop/direct/")) {
    return `wdt:${value.slice(36)}`;
  }
  return value;
}
```

This function maps common URI prefixes to their standard abbreviations: `dbr:` for DBPedia resources, `dbo:` for DBPedia ontology terms, `dbp:` for DBPedia properties, `wd:` for Wikidata entities, and `wdt:` for Wikidata direct properties. So instead of displaying `http://dbpedia.org/resource/Berlin` in the results table, we display `dbr:Berlin`—much more readable.

Notice that we handle both `http://` and `https://` for DBPedia resources. DBPedia has historically used `http://` URIs, but some responses now include `https://` variants. This kind of real-world inconsistency is common when working with Semantic Web data, and handling it gracefully is part of building a robust client.

### Value Formatting

The `formatValue` function handles the different types of values that appear in SPARQL results:

```typescript
function formatValue(binding: SparqlValue | undefined): string {
  if (!binding) return "";

  if (binding.type === "uri") {
    return shortenUri(binding.value);
  }

  if (binding.type === "literal" || binding.type === "typed-literal") {
    const datatype = binding.datatype;
    if (datatype === "http://www.w3.org/2001/XMLSchema#integer") {
      return parseInt(binding.value, 10).toLocaleString();
    }
    if (
      datatype === "http://www.w3.org/2001/XMLSchema#decimal" ||
      datatype === "http://www.w3.org/2001/XMLSchema#float" ||
      datatype === "http://www.w3.org/2001/XMLSchema#double"
    ) {
      return parseFloat(binding.value).toLocaleString();
    }
    if (
      datatype === "http://www.w3.org/2001/XMLSchema#dateTime" ||
      datatype === "http://www.w3.org/2001/XMLSchema#date"
    ) {
      return binding.value.slice(0, 10);
    }
  }

  return binding.value;
}
```

There are several cases to handle:

1. **Undefined bindings**: If the binding is `undefined` (from an `OPTIONAL` clause that did not match), we return an empty string.
2. **URIs**: Passed through `shortenUri` for compact display.
3. **Integers**: Parsed and formatted with locale-aware thousand separators. A population of `3645000` becomes `"3,645,000"`.
4. **Floating-point numbers**: Similarly formatted with `toLocaleString()`.
5. **Dates and datetimes**: Truncated to the first 10 characters (the `YYYY-MM-DD` portion). SPARQL date values often include time and timezone information that clutters the display.
6. **Plain literals**: Returned as-is. This covers strings like labels and descriptions.

The datatypes are XML Schema datatypes, which is the standard that RDF uses for typed literals. You will see these URI-based datatype identifiers in any SPARQL results that include numbers or dates.

### Rendering Results as HTML

The `renderResults` function builds an HTML table from the SPARQL JSON response:

```typescript
function renderResults(results: SparqlResults): string {
  const { vars } = results.head;
  const { bindings } = results.results;
  if (bindings.length === 0) {
    return '<p class="info">No results found.</p>';
  }

  let html = '<table class="results-table"><thead><tr>';
  for (const v of vars) {
    html += `<th>${v}</th>`;
  }
  html += "</tr></thead><tbody>";
  for (const row of bindings) {
    html += "<tr>";
    for (const v of vars) {
      html += `<td>${formatValue(row[v])}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}
```

The column headers come from `results.head.vars`—the list of variable names from the `SELECT` clause. Each row in `results.results.bindings` is an object mapping variable names to their `SparqlValue`. The function iterates over the variables for each row, calls `formatValue` to produce a display string, and builds the table HTML.

This approach is generic: it works with *any* SPARQL `SELECT` query, regardless of what variables are projected. You do not need to know the shape of the results at compile time. The table adapts automatically to whatever columns the query returns.

### Running a Query

The `runQuery` function ties the UI to the SPARQL client:

```typescript
let endpointSelect: HTMLSelectElement | null;
let queryInput: HTMLTextAreaElement | null;
let resultsEl: HTMLElement | null;

async function runQuery() {
  if (!endpointSelect || !queryInput || !resultsEl) return;

  const endpoint = endpointSelect.value as SparqlEndpoint;
  const query = queryInput.value.trim();

  resultsEl.innerHTML = '<p class="info">Loading...</p>';

  try {
    const data = await sparqlQuery(endpoint, query);
    const count = data.results.bindings.length;
    resultsEl.innerHTML =
      `<p class="info">${count} result${count === 1 ? "" : "s"} ` +
      `from ${endpoint}</p>`;
    resultsEl.innerHTML += renderResults(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    resultsEl.innerHTML =
      `<p class="error">Error: ${message}</p>`;
    if (endpoint === "dbpedia") {
      resultsEl.innerHTML +=
        '<p class="note">Note: DBPedia\'s SPARQL endpoint may be ' +
        "temporarily unavailable or require a different network " +
        "configuration.</p>";
    }
  }
}
```

The function reads the selected endpoint and the query text from the form, shows a loading indicator, calls `sparqlQuery`, and either renders the results or displays an error message. The error handling includes a special note for DBPedia, which is historically less reliable than Wikidata's query service. This is a practical consideration that saves users from confusion when DBPedia is having one of its occasional outages.

### DOM Initialization

Finally, the `DOMContentLoaded` event handler wires everything up:

```typescript
window.addEventListener("DOMContentLoaded", () => {
  endpointSelect = document.querySelector("#endpoint-select");
  queryInput = document.querySelector("#query-input");
  resultsEl = document.querySelector("#results");

  document
    .querySelector("#query-form")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      runQuery();
    });

  endpointSelect?.addEventListener("change", () => {
    if (queryInput && endpointSelect) {
      queryInput.value =
        DEFAULT_QUERIES[endpointSelect.value as SparqlEndpoint];
    }
  });

  if (queryInput && endpointSelect) {
    queryInput.value =
      DEFAULT_QUERIES[endpointSelect.value as SparqlEndpoint];
  }
});
```

There are three things happening here:

1. **Form submission**: The submit handler calls `preventDefault()` to stop the browser from navigating, then calls `runQuery()`.
2. **Endpoint switching**: When the user changes the endpoint dropdown, the textarea is automatically populated with the default query for that endpoint. This gives users a working example to start from.
3. **Initial population**: The textarea is populated with the default query for whichever endpoint is initially selected (Wikidata, since it has the `selected` attribute in the HTML).

## The HTML Shell

The HTML file is minimal—just a form and a results container:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/src/styles.css" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Semantic Web SPARQL Client</title>
    <script type="module" src="/src/main.ts" defer></script>
  </head>
  <body>
    <main class="container">
      <h1>Semantic Web SPARQL Client</h1>
      <p>Query DBPedia or Wikidata using SPARQL.</p>
      <form class="column" id="query-form">
        <label for="endpoint-select">Endpoint</label>
        <select id="endpoint-select">
          <option value="dbpedia">DBPedia</option>
          <option value="wikidata" selected>Wikidata</option>
        </select>
        <label for="query-input">SPARQL Query</label>
        <textarea
          id="query-input"
          rows="14"
          placeholder="Enter a SPARQL SELECT query..."
        ></textarea>
        <button type="submit">Run Query</button>
      </form>
      <div id="results"></div>
    </main>
  </body>
</html>
```

The `<select>` dropdown lists the two endpoints. The `<textarea>` with 14 rows gives enough room to display multi-line SPARQL queries comfortably. The `#results` div is where the rendered table (or error messages) will be injected. Vite handles the TypeScript compilation and module loading—the `<script type="module">` tag references the `.ts` file directly, and Vite transforms it during development.

## Running the Example

To run the semantic web application:

```bash
cd semantic-web-app
npm install
npm run tauri dev
```

The Tauri dev server will start Vite on port 1420 and open a native desktop window. You will see the SPARQL query form pre-populated with the Wikidata query for Albert Einstein.

Click **Run Query** to execute the default Wikidata query. You should see results similar to:

```
10 results from wikidata

personLabel     birthPlaceLabel    birthDate    occupationLabel
─────────────────────────────────────────────────────────────────
Albert Einstein Ulm                1879-03-14   physicist
Albert Einstein Ulm                1879-03-14   university teacher
Albert Einstein Ulm                1879-03-14   patent examiner
Albert Einstein Ulm                1879-03-14   philosopher
Albert Einstein Ulm                1879-03-14   inventor
Albert Einstein Ulm                1879-03-14   writer
Albert Einstein Ulm                1879-03-14   teacher
Albert Einstein Ulm                1879-03-14   diplomat
Albert Einstein Ulm                1879-03-14   theoretical physicist
Albert Einstein Ulm                1879-03-14   philosopher of science
```

Each row shares the same birth place and birth date, but lists a different occupation. This is the triple-based data model at work: Einstein has many `wdt:P106` (occupation) triples in Wikidata, and each one produces a separate result row.

Now switch the endpoint dropdown to **DBPedia** and click **Run Query**. The textarea will auto-populate with the cities-by-population query. After a moment (DBPedia can be slower), you should see the world's most populous cities:

```
10 results from dbpedia

city_uri             dbpedia_label    population    country_label
──────────────────────────────────────────────────────────────────
dbr:Shanghai         Shanghai         24,870,895    dbr:China
dbr:Beijing          Beijing          21,893,095    dbr:China
dbr:Delhi            Delhi            18,980,000    India
dbr:Lagos            Lagos            16,060,303    Nigeria
dbr:Istanbul         Istanbul         15,840,900    Turkey
dbr:Tokyo            Tokyo            14,094,034    Japan
dbr:Mumbai           Mumbai           12,478,447    India
dbr:Moscow           Moscow           12,380,664    Russia
dbr:São_Paulo        São Paulo        12,252,023    Brazil
dbr:Dhaka            Dhaka            10,278,882    Bangladesh
```

Notice how the URI shortening makes the `city_uri` column readable (`dbr:Shanghai` instead of `http://dbpedia.org/resource/Shanghai`), and how the population numbers are formatted with thousand separators. The country labels come from the `OPTIONAL` clause—if a city did not have a `dbo:country` link, that column would be empty rather than the entire row being excluded.

You can also write your own SPARQL queries. Here are a few to try:

**Find programming languages and their designers (Wikidata):**

```sparql
SELECT ?langLabel ?designerLabel ?yearLabel WHERE {
  ?lang wdt:P31 wd:Q9143 .
  ?lang wdt:P287 ?designer .
  OPTIONAL { ?lang wdt:P571 ?year . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} LIMIT 20
```

**Find universities in a country (DBPedia):**

```sparql
SELECT ?uni ?name WHERE {
  ?uni a <http://dbpedia.org/ontology/University> .
  ?uni <http://dbpedia.org/ontology/country> <http://dbpedia.org/resource/Canada> .
  ?uni <http://www.w3.org/2000/01/rdf-schema#label> ?name
    FILTER (lang(?name) = 'en') .
} LIMIT 15
```

## Wrap Up

In about 190 lines of TypeScript, we have built a fully functional SPARQL client that can query two of the world's largest knowledge graphs. The implementation is deliberately minimal—no third-party SPARQL libraries, no complex state management, just the `fetch` API and some careful type definitions.

The key ideas to take away from this chapter are:

- **RDF triples** are the universal data model of the Semantic Web. Everything is a subject–predicate–object statement, identified by URIs.
- **SPARQL** is a pattern-matching query language. You describe the shape of the triples you want, and the engine finds all matches.
- **Public SPARQL endpoints** like DBPedia and Wikidata are free to query. A polite User-Agent header and URL-encoded GET request are all you need.
- **The JSON results format** is standardized by the W3C, so the same TypeScript interfaces work with any SPARQL endpoint.
- **OPTIONAL clauses** prevent missing data from excluding entire rows—an important pattern when querying real-world knowledge graphs where data is often incomplete.
- **URI shortening** transforms verbose identifiers into the compact prefix notation that makes SPARQL results human-readable.

Knowledge graphs complement neural AI models beautifully. Where a language model might hallucinate a fact, a knowledge graph returns only what has been explicitly asserted and can be traced back to its source. As you build AI applications, consider using SPARQL queries against knowledge graphs as a way to ground your systems in verifiable, structured knowledge. The combination of a desktop Tauri shell and live SPARQL queries gives you a practical tool for exploring these massive knowledge bases interactively.
