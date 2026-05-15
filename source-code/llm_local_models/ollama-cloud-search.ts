// ollama-cloud-search.ts - Agent loop using Ollama Cloud API with web_search and web_fetch tool calling
//
// Usage: OLLAMA_API_KEY="your-key" tsx ollama-cloud-search.ts
//         or set OLLAMA_API_KEY in your environment

const CLOUD_MODEL = "gpt-oss:120b-cloud";
const CLOUD_HOST = "https://ollama.com/api/chat";

function getApiKey(): string {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY environment variable is not set");
  return key;
}

const webSearchSchema = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for current information",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query string",
        },
      },
      required: ["query"],
    },
  },
};

const webFetchSchema = {
  type: "function",
  function: {
    name: "web_fetch",
    description: "Fetch the content of a web page by URL",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch",
        },
      },
      required: ["url"],
    },
  },
};

const TOOLS = [webSearchSchema, webFetchSchema];

async function executeWebSearch(args: { query: string }): Promise<string> {
  const query = args.query ?? "";
  const encoded = encodeURIComponent(query);
  const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;

  console.log(`  [web_search] query: ${query}`);
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = await resp.text();
    console.log(`  [web_search] got ${text.length} chars`);
    return text;
  } catch (e: any) {
    return `web_search error: ${e.message}`;
  }
}

async function executeWebFetch(args: { url: string }): Promise<string> {
  const url = args.url ?? "";

  console.log(`  [web_fetch] url: ${url}`);
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    let text = await resp.text();
    if (text.length > 4000) text = text.slice(0, 4000);
    console.log(`  [web_fetch] got ${text.length} chars`);
    return text;
  } catch (e: any) {
    return `web_fetch error: ${e.message}`;
  }
}

interface Message {
  role: string;
  content: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

interface ToolCall {
  function: { name: string; arguments: any };
}

interface CloudResponse {
  message: Message;
}

async function cloudOllamaCall(messages: Message[]): Promise<CloudResponse> {
  const apiKey = getApiKey();

  console.log(`\nCalling Ollama Cloud (${CLOUD_MODEL})...`);

  const resp = await fetch(CLOUD_HOST, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLOUD_MODEL,
      stream: false,
      messages,
      tools: TOOLS,
    }),
  });

  const data = await resp.json();
  return data as CloudResponse;
}

async function cloudSearchAgent(prompt: string): Promise<string> {
  const messages: Message[] = [{ role: "user", content: prompt }];

  while (true) {
    const data = await cloudOllamaCall(messages);
    const msg = data.message;
    messages.push(msg);

    if (msg.tool_calls?.length) {
      console.log(`\nModel requested ${msg.tool_calls.length} tool call(s).`);

      for (const tc of msg.tool_calls) {
        const { name, arguments: args } = tc.function;
        let result: string;

        if (name === "web_search") {
          result = await executeWebSearch(args);
        } else if (name === "web_fetch") {
          result = await executeWebFetch(args);
        } else {
          result = `Unknown tool: ${name}`;
        }

        console.log(`  Tool ${name} completed.`);

        messages.push({
          role: "tool",
          content: result,
          tool_name: name,
        });
      }
    } else {
      console.log(`\nFinal Answer: ${msg.content}`);
      return msg.content ?? "No response";
    }
  }
}

const query =
  process.argv.length > 2
    ? process.argv.slice(2).join(" ")
    : "What is the current price of Bitcoin and who is the CEO of Nvidia?";

const answer = await cloudSearchAgent(query);
console.log(answer);

export {};
