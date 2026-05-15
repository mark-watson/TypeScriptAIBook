# LLMs with Local Models

Running language models on your own hardware gives you privacy, zero per-token cost, and the ability to work offline. The tradeoff is that local models are generally smaller and less capable than the frontier models available through cloud APIs, and running larger models requires significant GPU memory or Apple Silicon unified memory.

In this chapter we focus on [Ollama](https://ollama.com), the most popular tool for running local models. Ollama handles model downloading, quantization, GPU acceleration, and exposes a simple API — you can go from zero to a running local LLM in minutes. We also briefly mention alternative tools at the end of the chapter.

If you want to go deeper into Ollama, including tool use, agents, RAG, and advanced configuration, see my book [Ollama in Action](https://leanpub.com/ollama-in-action).

The examples for this chapter are in the directory **source-code/llm_local_models**.

{width: "80%"}
![Architecture diagram for Ollama local LLM server with five TypeScript client patterns](FIG_llm_local_models.jpg)


## Installing Ollama

Ollama is available for macOS, Linux, and Windows. On macOS:

```bash
brew install ollama
```

Or download the installer from [ollama.com](https://ollama.com). After installation, start the Ollama service:

```bash
ollama serve
```

This starts a local server on port 11434. The service runs in the background and manages model loading, GPU memory, and request handling.


## Downloading and Running Models

Ollama uses a Docker-like model for pulling and running models. To download a model:

```bash
ollama pull llama3.2:3b
```

This downloads Meta's Llama 3.2 with 3 billion parameters, quantized to about 2 GB. You can interact with it immediately from the command line:

```bash
ollama run llama3.2:3b "What is the capital of France?"
```

Some recommended models to start with:

| Model | Size | Strengths |
|-------|------|-----------|
| llama3.2:3b | 2 GB | Fast, good general purpose |
| gemma3:4b | 3 GB | Google's small model, strong reasoning |
| qwen3:4b | 2.6 GB | Excellent multilingual and coding |
| deepseek-r1:7b | 4.7 GB | Strong reasoning with explicit chain-of-thought |
| llava:7b | 4.7 GB | Vision model — can analyze images |


## Using Ollama from TypeScript

The **ollama** npm package provides a clean TypeScript interface to the local Ollama service.

```bash
npm install ollama
```

### Basic Text Generation

The simplest use of the Ollama SDK — send a prompt and print the response:

```typescript
// ollama_text.ts - Basic text generation with a local model

import ollama from "ollama";

const response = await ollama.chat({
  model: "llama3.2:3b",
  messages: [
    { role: "user", content: "Briefly explain what a neural network is." },
  ],
});

console.log(response.message.content);
```

This is similar in structure to the cloud API examples from the previous chapter, but the request never leaves your machine.

### Streaming Responses

For interactive applications, streaming lets users see output as it's generated rather than waiting for the complete response:

```typescript
// ollama_streaming.ts - Streaming responses for real-time output

import ollama from "ollama";

const stream = await ollama.chat({
  model: "llama3.2:3b",
  messages: [
    { role: "user", content: "Write a short poem about programming." },
  ],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}
console.log(); // final newline
```

Each chunk contains a small piece of the response. The `for await...of` syntax makes it clean to iterate over the async stream.


## Reasoning with Local Models

Some local models support explicit chain-of-thought reasoning, where the model shows its thinking process before providing a final answer. DeepSeek-R1 is particularly good at this.

First pull the model:

```bash
ollama pull deepseek-r1:7b
```

Here is an example that extracts both the reasoning trace and the final answer:

```typescript
// ollama_reasoning.ts - Chain-of-thought reasoning with DeepSeek-R1

import ollama from "ollama";

async function reasonAbout(
  question: string,
  model: string = "deepseek-r1:7b"
): Promise<{ reasoning: string; answer: string }> {
  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: question }],
  });

  const content = response.message.content;

  // DeepSeek-R1 wraps reasoning in <think>...</think> tags
  let reasoning = "";
  let answer = content;

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    reasoning = thinkMatch[1].trim();
    answer = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  }

  return { reasoning, answer };
}

const question =
  "A bakery sells 3 types of bread. Each type comes in 2 sizes. " +
  "How many different bread options are available? " +
  "Respond with just the number and a brief explanation.";

const result = await reasonAbout(question);

if (result.reasoning) {
  console.log("=== Reasoning ===");
  console.log(result.reasoning);
  console.log();
}

console.log("=== Answer ===");
console.log(result.answer);
```

The model's reasoning trace shows each step of its thinking, making the output more transparent and debuggable than a black-box answer.


## Conversation Memory with Ollama

Cloud APIs handle conversation history by passing the full message list with each request. With local models the same pattern applies, but since there are no per-token costs, you can maintain longer conversations without worrying about expense.

```typescript
// ollama_memory.ts - Conversation with persistent memory

import ollama from "ollama";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

class LocalAssistant {
  private model: string;
  private messages: Message[] = [];

  constructor(model: string = "llama3.2:3b", systemPrompt: string = "") {
    this.model = model;
    if (systemPrompt) {
      this.messages.push({ role: "system", content: systemPrompt });
    }
  }

  async chat(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage });

    const response = await ollama.chat({
      model: this.model,
      messages: this.messages,
    });

    const reply = response.message.content;
    this.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  get messageCount(): number {
    return this.messages.length;
  }
}

// Create an assistant with a specific personality
const assistant = new LocalAssistant(
  "llama3.2:3b",
  "You are a concise technical writing assistant. Keep answers under 3 sentences."
);

// Multi-turn conversation
console.log("Q: What is gradient descent?");
console.log("A:", await assistant.chat("What is gradient descent?"));
console.log();

console.log("Q: How does the learning rate affect it?");
console.log("A:", await assistant.chat("How does the learning rate affect it?"));
console.log();

console.log("Q: What happens if I set it too high?");
console.log("A:", await assistant.chat("What happens if I set it too high?"));
console.log();

console.log(`(Conversation has ${assistant.messageCount} messages)`);
```

Note that unlike cloud APIs, keeping long conversation histories in local models is free — there are no per-token costs. The main constraint is the model's context window size.


## Describe Content of Images

Here we look at the example `ollama_describe-image.ts` that can read images and describe what is on the image. Here I use an image of a symphony ticket.

Many Ollama models support vision — they can accept images alongside text and describe their contents. To use this, pass base64-encoded images as an `images` array on the user message.

```typescript
// ollama_describe-image.ts - Send images to Ollama vision models for description
//
// Usage:
//   tsx ollama_describe-image.ts [image] [prompt...]
//
// Environment:
//   OLLAMA_MODEL — optional model override (default: qwen3.5:0.8b)
//   OLLAMA_HOST  — optional API host override (default: http://localhost:11434)

import ollama from "ollama";
import { readFileSync, existsSync } from "fs";

const MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:0.8b";
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

function encodeImage(imagePath: string): string {
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  return readFileSync(imagePath).toString("base64");
}

async function imageToText(
  imagePaths: string | string[],
  prompt: string,
  model: string = MODEL,
  host: string = HOST
): Promise<string> {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  for (const p of paths) {
    if (!existsSync(p)) {
      throw new Error(`Image file not found: ${p}`);
    }
  }
  const images = paths.map(encodeImage);
  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: prompt, images }],
    host,
  });
  return response.message.content;
}

async function describeImageSimple(imagePath: string): Promise<string> {
  return imageToText(imagePath, "What is in this image?");
}

const [,, imageArg, ...promptArgs] = process.argv;
const imagePath = imageArg ?? "ticket.png";
const promptText = promptArgs.length > 0
  ? promptArgs.join(" ")
  : "Print out the plain text in this image";

const result = await imageToText(imagePath, promptText);
console.log(result);
```

The key difference from a text-only request is the `images` field on the message, which holds an array of base64-encoded image strings. The `encodeImage` function reads a file and converts it to base64 — no external dependencies needed.

You can pass a single image or multiple images. The `imageToText` function accepts either a string path or an array of paths, making it easy to compare images side by side, for example:

```bash
$ tsx ollama_describe-image.ts ticket.png "Extract the plain text from this image"
Mark Watson Fanfares and Fireworks Flagstaff Symphony Orchestra Ardrey Memorial Auditorium Friday, September 26, 2025 7:30 PM (AZ) #1 / 2 WJNBY.1.2406.1498 Friday, September 26, 2025 @ 7:30 PM LEVEL Main SECTION Main Level ROW M SEAT 31 Price $53.00 SERVICE FEE $0.00 TICKET OPTION Early Bird Tickets TICKET Type New Subscriber C3 The unique barcodes on this ticket allow only one entry to the event. If multiple copies of an ETTicket are made, the first copy of the ETTicket to arrive at the event will gain entry after scanning and validation. Other copies of this ticket will be denied entry.
$ 
$ tsx ollama_describe-image.ts ticket.png "Extract the price of the ticket from this image"
The price of the ticket is $53.00.
```

Vision models like **qwen3.5:0.8b** and **llava:7b** handle these requests locally on your machine, keeping image data private. Pull the model first with `ollama pull qwen3.5:0.8b`.

The `ollama describe` npm script in `package.json` runs this file with defaults — useful for a quick test with the included `ticket.png` sample image.

{pagebreak}

## Adding Web Search Tools

The Ollama Cloud API provides access to larger models like `gpt-oss:120b-cloud` that support function calling — the model can request external tools during a conversation. This enables an agent loop pattern where the model decides when to search the web or fetch a URL, your code executes those actions, and the results feed back into the model's context.

The example `ollama-cloud-search.ts` defines two tools — `web_search` and `web_fetch` — and runs an agent loop that calls the Ollama Cloud API, executes any requested tool calls, and continues until the model produces a final answer.

```typescript
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
```

### How Tool Calling Works

The **tool schemas** (`webSearchSchema` and `webFetchSchema`) define what each tool does and the parameters it accepts. These schemas follow the OpenAI function-calling format, which the Ollama Cloud API uses. When you include the `tools` array in the request body, the model can decide to call one or more tools instead of (or in addition to) returning text.

The tool call response from the model includes a `tool_calls` array with the function name and arguments. Your code executes the tool — for `web_search`, that means hitting the DuckDuckGo API; for `web_fetch`, fetching the URL with a 15-second timeout and truncating the result to 4000 characters to stay within model context limits.

Each tool result is appended to the conversation as a message with `role: "tool"` and `tool_name` set to the function name. The loop then calls the API again so the model can process the results and either request more tools or produce a final answer.

### Running the Agent

You need an Ollama Cloud API key (set as `OLLAMA_API_KEY` in your environment) and a cloud model available in your account:

```bash
$ OLLAMA_API_KEY="ollama-ck-..." tsx ollama-cloud-search.ts "What is the price of Gold and who is the CEO of Toyota?"
  [web_search] query: Toyota CEO 2025
  [web_search] got 1204 chars
  Tool web_search completed.
  [web_search] query: Gold price today
  [web_search] got 1142 chars
  Tool web_search completed.

Final Answer: The current price of gold is $2,034.50 per ounce. As of 2025, Koji Sato is the CEO of Toyota Motor Corporation, having taken over from Akio Toyoda.
```

The agent made two parallel web search calls, received the results, and synthesized them into a final answer. The `cloud-search` npm script in `package.json` runs this file with defaults, or you can pass a custom query as command-line arguments.

Unlike local models, the Ollama Cloud API routes your request to larger hosted models, which have stronger reasoning and more up-to-date knowledge. The tradeoff is that requests leave your machine and you pay for API usage — but with the benefit of tool-calling capabilities that enable this agent pattern.


## OpenAI-Compatible API

Ollama exposes an OpenAI-compatible API endpoint, which means you can use the standard **openai** npm package to talk to local models. This is useful if you want to write code that can switch between cloud and local models by changing only the base URL:

```typescript
// ollama_openai_compat.ts - Using local Ollama with the OpenAI SDK

import OpenAI from "openai";

// Point the OpenAI client at the local Ollama server
const client = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "not-needed", // Ollama doesn't require auth locally
});

const response = await client.chat.completions.create({
  model: "llama3.2:3b",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    {
      role: "user",
      content: "What is the difference between a list and a tuple in Python?",
    },
  ],
  temperature: 0.7,
});

console.log(response.choices[0].message.content);
```

This compatibility layer means you can prototype with local models and then switch to OpenAI, Gemini, or another provider by changing the client configuration — the rest of your code stays the same.


## Alternative Tools for Running Local Models

While Ollama is the system I usually use for running local models, several alternatives exist:

- **llama.cpp**: The C++ inference engine that Ollama is built on. Use it directly if you need maximum control over quantization, batching, or want to embed inference in a C/C++ application. Available at [github.com/ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp).

- **LM Studio**: A desktop application with a graphical interface for downloading, managing, and chatting with local models. Good for non-programmers or for quickly trying different models. Available at [lmstudio.ai](https://lmstudio.ai).

- **vLLM**: A high-performance inference server optimized for throughput. Best suited for serving models to multiple users in production. Available at [github.com/vllm-project/vllm](https://github.com/vllm-project/vllm).


## Hardware Considerations

The amount of memory you need depends on the model size:

| Model Parameters | Quantized Size | Minimum RAM/VRAM |
|-----------------|----------------|-------------------|
| 1-3B | 1-2 GB | 8 GB RAM |
| 7-8B | 4-5 GB | 16 GB RAM |
| 14B | 8-9 GB | 16 GB RAM |
| 32-70B | 18-40 GB | 32-64 GB RAM |

On macOS with Apple Silicon (M1/M2/M3/M4), models run on the GPU using unified memory, which means your total system RAM is also your GPU memory. A MacBook with 16 GB of RAM can comfortably run 7-8B parameter models, and 32 GB or more enables larger models.

On Linux and Windows, a dedicated NVIDIA GPU with sufficient VRAM provides the best performance. Models can also run on CPU only, but inference is significantly slower.


## Summary

Running LLMs locally with Ollama gives you a private, cost-free, offline-capable alternative to cloud APIs. The setup is straightforward — install Ollama, pull a model, and start making API calls from TypeScript. Features like streaming, conversation memory, prompt caching, and reasoning models make local models practical for many real applications.

The main tradeoff is capability: the largest models that run locally (7-14B parameters on typical hardware) are less capable than frontier cloud models with hundreds of billions of parameters. For many tasks — code assistance, text summarization, data extraction, conversational interfaces — local models perform well enough, and the privacy and cost benefits make them the better choice.

