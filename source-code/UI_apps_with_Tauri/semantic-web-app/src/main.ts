// SPARQL client for DBPedia and Wikidata.
// Inspired by the examples in TypeScriptAIBook/source-code/knowledge_representation.

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
  wikidata: `SELECT ?personLabel ?birthPlaceLabel ?birthDate ?occupationLabel WHERE {
  ?person wdt:P31 wd:Q5 .
  ?person rdfs:label "Albert Einstein"@en .
  OPTIONAL { ?person wdt:P19 ?birthPlace . }
  OPTIONAL { ?person wdt:P569 ?birthDate . }
  OPTIONAL { ?person wdt:P106 ?occupation . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
} LIMIT 10`,
};

async function sparqlQuery(endpoint: SparqlEndpoint, query: string): Promise<SparqlResults> {
  const config = ENDPOINTS[endpoint];
  const resp = await fetch(`${config.url}?query=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": config.userAgent,
    },
  });
  if (!resp.ok) {
    throw new Error(`SPARQL query failed: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

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
    if (datatype === "http://www.w3.org/2001/XMLSchema#decimal" ||
        datatype === "http://www.w3.org/2001/XMLSchema#float" ||
        datatype === "http://www.w3.org/2001/XMLSchema#double") {
      return parseFloat(binding.value).toLocaleString();
    }
    if (datatype === "http://www.w3.org/2001/XMLSchema#dateTime" ||
        datatype === "http://www.w3.org/2001/XMLSchema#date") {
      return binding.value.slice(0, 10);
    }
  }

  return binding.value;
}

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
    resultsEl.innerHTML = `<p class="info">${count} result${count === 1 ? "" : "s"} from ${endpoint}</p>`;
    resultsEl.innerHTML += renderResults(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    resultsEl.innerHTML = `<p class="error">Error: ${message}</p>`;
    if (endpoint === "dbpedia") {
      resultsEl.innerHTML += '<p class="note">Note: DBPedia\'s SPARQL endpoint may be temporarily unavailable or require a different network configuration.</p>';
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  endpointSelect = document.querySelector("#endpoint-select");
  queryInput = document.querySelector("#query-input");
  resultsEl = document.querySelector("#results");

  document.querySelector("#query-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    runQuery();
  });

  endpointSelect?.addEventListener("change", () => {
    if (queryInput && endpointSelect) {
      queryInput.value = DEFAULT_QUERIES[endpointSelect.value as SparqlEndpoint];
    }
  });

  if (queryInput && endpointSelect) {
    queryInput.value = DEFAULT_QUERIES[endpointSelect.value as SparqlEndpoint];
  }
});
