// wikidata_person.ts - Query Wikidata for information about a person

async function sparqlQuery(endpoint: string, query: string): Promise<any> {
  const url = `${endpoint}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "TypeScriptAIBook/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`SPARQL query failed: ${response.status}`);
  }
  return response.json();
}

const query = `
SELECT ?personLabel ?birthPlaceLabel ?birthDate ?occupationLabel
WHERE {
    ?person wdt:P31 wd:Q5 .
    ?person rdfs:label "Albert Einstein"@en .
    OPTIONAL { ?person wdt:P19 ?birthPlace . }
    OPTIONAL { ?person wdt:P569 ?birthDate . }
    OPTIONAL { ?person wdt:P106 ?occupation . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 10
`;

const results = await sparqlQuery("https://query.wikidata.org/sparql", query);

console.log("=== Wikidata query: Albert Einstein ===\n");
for (const r of results.results.bindings) {
  console.log(`  Name: ${r.personLabel.value}`);
  if (r.birthPlaceLabel) console.log(`  Born: ${r.birthPlaceLabel.value}`);
  if (r.birthDate) console.log(`  Date: ${r.birthDate.value.slice(0, 10)}`);
  if (r.occupationLabel) console.log(`  Occupation: ${r.occupationLabel.value}`);
  console.log();
}
