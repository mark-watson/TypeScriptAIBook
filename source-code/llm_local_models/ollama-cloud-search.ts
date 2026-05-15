// ollama-cloud-search.ts - Agent loop using Ollama Cloud API with web_search and web_fetch tool calling
//
// Usage: OLLAMA_API_KEY="your-key" tsx ollama-cloud-search.ts

const CLOUD_MODEL = "gpt-oss:120b-cloud";
const CLOUD_HOST = "https://ollama.com/api/chat";
const API_KEY = process.env.OLLAMA_API_KEY;
if (!API_KEY) throw new Error("OLLAMA_API_KEY environment variable is not set");

const mkTool = (name: string, desc: string, param: string, pdesc: string) => ({
  type: "function",
  function: {
    name, description: desc,
    parameters: { type: "object", properties: { [param]: { type: "string", description: pdesc } }, required: [param] },
  },
});

const TOOLS = [
  mkTool("web_search", "Search the web for current information", "query", "The search query string"),
  mkTool("web_fetch", "Fetch the content of a web page by URL", "url", "The URL to fetch"),
];

async function executeWebSearch(args: { query: string }): Promise<string> {
  const q = args.query ?? "";
  console.log(`  [web_search] query: ${q}`);
  try {
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const text = await resp.text();
    console.log(`  [web_search] got ${text.length} chars`);
    return text;
  } catch (e: any) { return `web_search error: ${e.message}`; }
}

async function executeWebFetch(args: { url: string }): Promise<string> {
  console.log(`  [web_fetch] url: ${args.url}`);
  try {
    const resp = await fetch(args.url ?? "", { signal: AbortSignal.timeout(15_000) });
    let text = await resp.text();
    if (text.length > 4000) text = text.slice(0, 4000);
    console.log(`  [web_fetch] got ${text.length} chars`);
    return text;
  } catch (e: any) { return `web_fetch error: ${e.message}`; }
}

const TOOL_FNS: Record<string, (args: any) => Promise<string>> = {
  web_search: executeWebSearch,
  web_fetch: executeWebFetch,
};

interface Message { role: string; content: string; tool_calls?: { function: { name: string; arguments: any } }[]; tool_name?: string }

async function cloudOllamaCall(messages: Message[]) {
  console.log(`\nCalling Ollama Cloud (${CLOUD_MODEL})...`);
  const resp = await fetch(CLOUD_HOST, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: CLOUD_MODEL, stream: false, messages, tools: TOOLS }),
  });
  return (await resp.json()) as { message: Message };
}

async function cloudSearchAgent(prompt: string): Promise<string> {
  const messages: Message[] = [{ role: "user", content: prompt }];

  while (true) {
    const { message: msg } = await cloudOllamaCall(messages);
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      console.log(`\nFinal Answer: ${msg.content}`);
      return msg.content ?? "No response";
    }

    console.log(`\nModel requested ${msg.tool_calls.length} tool call(s).`);
    for (const tc of msg.tool_calls) {
      const { name, arguments: args } = tc.function;
      const fn = TOOL_FNS[name];
      const result = fn ? await fn(args) : `Unknown tool: ${name}`;
      console.log(`  Tool ${name} completed.`);
      messages.push({ role: "tool", content: result, tool_name: name });
    }
  }
}

const query = process.argv.length > 2
  ? process.argv.slice(2).join(" ")
  : "What is the current price of Bitcoin and who is the CEO of Nvidia?";

console.log(await cloudSearchAgent(query));
export {};
