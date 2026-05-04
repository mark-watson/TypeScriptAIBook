// dbpedia_cities.ts - Query DBPedia for city data

const query = `
SELECT ?city_uri ?dbpedia_label ?population ?country_label
WHERE {
    ?city_uri
        <http://dbpedia.org/ontology/type>
        <http://dbpedia.org/resource/City> .
    ?city_uri
        <http://dbpedia.org/property/populationEst>
        ?population .
    ?city_uri
         <http://www.w3.org/2000/01/rdf-schema#label>
         ?dbpedia_label FILTER (lang(?dbpedia_label) = 'en') .
    OPTIONAL {
        ?city_uri <http://dbpedia.org/ontology/country> ?country .
        ?country <http://www.w3.org/2000/01/rdf-schema#label>
                 ?country_label FILTER (lang(?country_label) = 'en') .
    }
}
ORDER BY DESC(?population)
LIMIT 10
`;

const url = `http://dbpedia.org/sparql?query=${encodeURIComponent(query)}`;

try {
  const response = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
  });

  if (!response.ok) {
    throw new Error(`DBPedia query failed: ${response.status}`);
  }

  const results = await response.json();

  console.log("=== DBPedia: Top 10 cities by population ===\n");
  for (const r of results.results.bindings) {
    const city = r.dbpedia_label.value;
    const pop = parseInt(r.population.value).toLocaleString();
    const country = r.country_label?.value ?? "unknown";
    console.log(`  ${city} (${country}): population ${pop}`);
  }
} catch (err) {
  console.error("Error querying DBPedia:", err);
  console.error("Note: DBPedia's SPARQL endpoint may be temporarily unavailable.");
}
