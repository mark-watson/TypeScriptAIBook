# Knowledge Representation Examples

SPARQL queries (Wikidata, DBPedia) and SQLite knowledge base.

## Architecture

![Knowledge engine integrating DBpedia and Wikidata SPARQL endpoints with an in-memory SQLite knowledge graph](FIG_knowledge_representation.jpg)

## Setup

```bash
npm install
```

## Run

```bash
npx tsx wikidata_person.ts    # queries Wikidata (no API key needed)
npx tsx dbpedia_cities.ts     # queries DBPedia (no API key needed)
npx tsx sqlite_knowledge.ts   # in-memory SQLite knowledge base
```
