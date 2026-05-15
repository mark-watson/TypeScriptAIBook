# Getting Setup To Use Graph and Relational Databases

I use several types of data stores in my work but for the purposes of this book we can explore knowledge representation using two key platforms:

- [RDF data](https://www.w3.org/RDF/) via TypeScript's `fetch` API and public SPARQL endpoints like [Wikidata](https://query.wikidata.org/) and [DBPedia](https://dbpedia.org/sparql) for graph-based knowledge representation.
- [SQLite](https://www.sqlite.org/index.html) for relational knowledge representation using the [SQL query language](https://en.wikipedia.org/wiki/SQL) via the **better-sqlite3** npm package.

The next chapter covers RDF and the SPARQL query language in more detail.

The examples for this chapter are in the directory **source-code/knowledge_representation**.

{width: "80%"}
![Architecture diagram for knowledge representation using SPARQL endpoints and SQLite](FIG_knowledge_representation.jpg)

In technical terms, knowledge representation using graph and relational databases involves the use of graph structures and relational data models to represent and organize knowledge in a structured, computationally efficient, and easily accessible way.

A graph structure is a collection of nodes (also known as vertices) and edges (also known as arcs) that connect the nodes. Each node and edge in a graph can have properties, such as labels and attributes which provide information about the entities they represent. Graphs can be used to represent knowledge in a variety of ways, such as through semantic networks and using ontologies to define terms, classes, types, etc.

Relational databases, on the other hand, use a tabular data model to represent knowledge. The basic building block of a relational database is the table, which is a collection of rows and columns. Each row represents an instance of an entity, and the columns provide information about the properties of that entity. Relationships between entities can also be represented by foreign keys, which link one table to another.

## Querying Wikidata with SPARQL and TypeScript

[Wikidata](https://www.wikidata.org/) is a free, open knowledge base maintained by the Wikimedia Foundation. It contains structured data about millions of entities — people, places, organizations, scientific concepts, and more — all accessible through a public SPARQL endpoint.

In TypeScript, we use the built-in `fetch` API to query SPARQL endpoints directly — no additional libraries needed:

### Finding Information About a Person

Let's query Wikidata for information about a specific person:

```typescript
// wikidata_person.ts - Query Wikidata for information about a person

async function sparqlQuery(endpoint: string, query: string) {
  const resp = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "TypeScriptAIBook/1.0" },
  });
  if (!resp.ok) throw new Error(`SPARQL query failed: ${resp.status}`);
  return resp.json();
}

const results = await sparqlQuery("https://query.wikidata.org/sparql", `
  SELECT ?personLabel ?birthPlaceLabel ?birthDate ?occupationLabel WHERE {
    ?person wdt:P31 wd:Q5 .
    ?person rdfs:label "Albert Einstein"@en .
    OPTIONAL { ?person wdt:P19 ?birthPlace . }
    OPTIONAL { ?person wdt:P569 ?birthDate . }
    OPTIONAL { ?person wdt:P106 ?occupation . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
  } LIMIT 10
`);

for (const r of results.results.bindings) {
  console.log(`  Name: ${r.personLabel.value}`);
  if (r.birthPlaceLabel) console.log(`  Born: ${r.birthPlaceLabel.value}`);
  if (r.birthDate) console.log(`  Date: ${r.birthDate.value.slice(0, 10)}`);
  if (r.occupationLabel) console.log(`  Occupation: ${r.occupationLabel.value}`);
  console.log();
}
```

The output shows Wikidata returning multiple results — one per occupation — for the same person:

```
$ tsx wikidata_person.ts
  Name: Albert Einstein
  Born: Ulm
  Date: 1879-03-14
  Occupation: scientist

  Name: Albert Einstein
  Born: Ulm
  Date: 1879-03-14
  Occupation: physicist

  Name: Albert Einstein
  Born: Ulm
  Date: 1879-03-14
  Occupation: mathematician
  ...
```

Key things to notice about Wikidata's SPARQL:

- **wdt:** properties represent direct claims (e.g., wdt:P19 is "place of birth")
- **wd:** entities are Wikidata items (e.g., wd:Q5 is "human")
- The **SERVICE wikibase:label** clause automatically resolves entity IDs to human-readable labels
- **OPTIONAL** prevents the query from failing when a property is missing

### Querying Cities and Their Properties from DBPedia

DBPedia mirrors much of Wikipedia's structured content as RDF triples. Here we query for cities and their populations:

```typescript
// dbpedia_cities.ts - Query DBPedia for city data

const query = `
SELECT ?city_uri ?dbpedia_label ?population ?country_label WHERE {
  ?city_uri <http://dbpedia.org/ontology/type> <http://dbpedia.org/resource/City> .
  ?city_uri <http://dbpedia.org/property/populationEst> ?population .
  ?city_uri <http://www.w3.org/2000/01/rdf-schema#label> ?dbpedia_label
    FILTER (lang(?dbpedia_label) = 'en') .
  OPTIONAL {
    ?city_uri <http://dbpedia.org/ontology/country> ?country .
    ?country <http://www.w3.org/2000/01/rdf-schema#label> ?country_label
      FILTER (lang(?country_label) = 'en') .
  }
} ORDER BY DESC(?population) LIMIT 10`;

try {
  const resp = await fetch(`http://dbpedia.org/sparql?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (!resp.ok) throw new Error(`DBPedia query failed: ${resp.status}`);
  const results = await resp.json();

  for (const r of results.results.bindings) {
    const city = r.dbpedia_label.value;
    const pop = parseInt(r.population.value).toLocaleString();
    console.log(`  ${city} (${r.country_label?.value ?? "unknown"}): population ${pop}`);
  }
} catch (err) {
  console.error("Error querying DBPedia:", err);
}
```

Notice that TypeScript's built-in `fetch` is all we need to query any SPARQL endpoint — no special library required. The SPARQL results come back as JSON which TypeScript handles natively.


## The SQLite Relational Database for Knowledge Representation

For local relational data, we use the **better-sqlite3** package which provides a synchronous, fast SQLite interface for Node.js:

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### Modeling a Knowledge Graph in SQLite

Relational databases become knowledge representation tools when we design tables to capture entities, their types, their attributes, and the relationships between them:

```typescript
// sqlite_knowledge.ts - Knowledge representation with SQLite

import Database from "better-sqlite3";

function buildKnowledgeBase(): Database.Database {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE scientists (id INTEGER PRIMARY KEY, name TEXT NOT NULL, birth_year INTEGER, nationality TEXT);
    CREATE TABLE fields (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT);
    CREATE TABLE discoveries (id INTEGER PRIMARY KEY, name TEXT NOT NULL, year INTEGER, description TEXT);
    CREATE TABLE scientist_field (scientist_id INTEGER REFERENCES scientists(id), field_id INTEGER REFERENCES fields(id), PRIMARY KEY (scientist_id, field_id));
    CREATE TABLE scientist_discovery (scientist_id INTEGER REFERENCES scientists(id), discovery_id INTEGER REFERENCES discoveries(id), PRIMARY KEY (scientist_id, discovery_id));
  `);

  const ins = (tbl: string, cols: number) =>
    db.prepare(`INSERT INTO ${tbl} VALUES (${Array(cols).fill("?").join(",")})`);

  const [iS, iF, iD, iSF, iSD] = [
    ins("scientists", 4), ins("fields", 3), ins("discoveries", 4),
    ins("scientist_field", 2), ins("scientist_discovery", 2),
  ];

  iS.run(1, "Albert Einstein", 1879, "German");
  iS.run(2, "Marie Curie", 1867, "Polish");
  iS.run(3, "Richard Feynman", 1918, "American");

  iF.run(1, "Physics", "Study of matter, energy, and their interactions");
  iF.run(2, "Chemistry", "Study of composition and properties of matter");
  iF.run(3, "Quantum Mechanics", "Physics of atomic and subatomic systems");

  iD.run(1, "Special Relativity", 1905, "Time and space are relative");
  iD.run(2, "Radioactivity", 1898, "Discovery of radium and polonium");
  iD.run(3, "Quantum Electrodynamics", 1948, "Quantum theory of light and matter");

  iSF.run(1, 1); iSF.run(1, 3); iSF.run(2, 1); iSF.run(2, 2); iSF.run(3, 1); iSF.run(3, 3);
  iSD.run(1, 1); iSD.run(2, 2); iSD.run(3, 3);

  return db;
}

function queryKnowledgeBase(db: Database.Database) {
  console.log("Scientists in Quantum Mechanics:");
  for (const r of db.prepare(`
    SELECT s.name, s.nationality FROM scientists s
    JOIN scientist_field sf ON s.id = sf.scientist_id
    JOIN fields f ON sf.field_id = f.id
    WHERE f.name = 'Quantum Mechanics'
  `).all() as any[]) console.log(`  ${r.name} (${r.nationality})`);

  console.log("\nDiscoveries by scientist:");
  for (const r of db.prepare(`
    SELECT s.name, d.name AS discovery, d.year, d.description FROM scientists s
    JOIN scientist_discovery sd ON s.id = sd.scientist_id
    JOIN discoveries d ON sd.discovery_id = d.id ORDER BY d.year
  `).all() as any[]) console.log(`  ${r.name}: ${r.discovery} (${r.year}) — ${r.description}`);

  console.log("\nScientists who share a field:");
  for (const r of db.prepare(`
    SELECT s1.name AS name1, s2.name AS name2, f.name AS field FROM scientist_field sf1
    JOIN scientist_field sf2 ON sf1.field_id = sf2.field_id AND sf1.scientist_id < sf2.scientist_id
    JOIN scientists s1 ON sf1.scientist_id = s1.id
    JOIN scientists s2 ON sf2.scientist_id = s2.id
    JOIN fields f ON sf1.field_id = f.id
  `).all() as any[]) console.log(`  ${r.name1} & ${r.name2}: ${r.field}`);
}

const db = buildKnowledgeBase();
queryKnowledgeBase(db);
db.close();
```

The output shows how SQL JOIN queries traverse the relationships between entities:

```
Scientists in Quantum Mechanics:
  Albert Einstein (German)
  Richard Feynman (American)

Discoveries by scientist:
  Marie Curie: Radioactivity (1898) — Discovery of radium and polonium
  Albert Einstein: Special Relativity (1905) — Time and space are relative
  Richard Feynman: Quantum Electrodynamics (1948) — Quantum theory of light and matter

Scientists who share a field:
  Albert Einstein & Marie Curie: Physics
  Albert Einstein & Richard Feynman: Physics
  Albert Einstein & Richard Feynman: Quantum Mechanics
  Marie Curie & Richard Feynman: Physics
```

The key insight is that the **relationship tables** (scientist_field, scientist_discovery) transform a flat relational database into a knowledge representation. Each relationship table captures a specific type of connection between entity types, and SQL JOINs let you traverse these connections to answer knowledge queries.

We will combine the use of SQLite, RDF, SPARQL, and deep learning NLP libraries later in the book.

If you want to deepen your understanding of the standards behind the SPARQL queries we used in this chapter, the next chapter provides optional reference material on RDF data formats, RDFS sub-property hierarchies, the SPARQL query language in detail, and OWL reasoning.

