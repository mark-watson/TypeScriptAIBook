# LLMs with Public APIs

The fastest way to use large language models is through cloud APIs. Google, OpenAI, and Anthropic all offer APIs that give you access to their most capable models with just a few lines of TypeScript code. You don't need a GPU, you don't need to download model weights, and you can start building applications in minutes.

In this chapter we work through practical examples using the Google Gemini API and the OpenAI API. Both provide TypeScript/JavaScript client libraries that handle authentication, request formatting, and response parsing. The patterns you learn here apply to other API providers as well, the core concepts of sending prompts, receiving completions, and managing conversations are the same across providers.

The examples for this chapter are in the directory **source-code/llm_public_apis**.

{width: "80%"}
![Architecture diagram for Google Gemini and OpenAI API integration patterns](FIG_llm_public_apis.jpg)

## Setup and Authentication

### Google Gemini

Google's Gemini models are accessed through the Google AI API using the **@google/genai** TypeScript SDK. You need a free API key from [Google AI Studio](https://aistudio.google.com/apikey).

Install the SDK:

```bash
npm install @google/genai
```

Store your API key in an environment variable:

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

Here is the simplest possible example, send a prompt to Gemini and print the response:

```typescript
// gemini_text.ts - Basic text generation with Google Gemini

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Briefly explain what a transformer model is in AI.",
});

console.log(response.text);
```

The output will be a concise explanation of transformer models. Each call to **generateContent** sends a request to Google's servers, which run the model and return the generated text.

### OpenAI

OpenAI's GPT models are accessed through the **openai** TypeScript SDK. You need an API key from [OpenAI's platform](https://platform.openai.com/api-keys).

Install the SDK:

```bash
npm install openai
```

Store your API key:

```bash
export OPENAI_API_KEY="your-api-key-here"
```

Here is the equivalent example using OpenAI:

```typescript
// openai_text.ts - Basic text generation with OpenAI

import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from environment

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Briefly explain what a transformer model is in AI." },
  ],
});

console.log(response.choices[0].message.content);
```

Both APIs follow the same pattern: create a client, send a prompt, and extract the generated text from the response.


## Text Generation

Text generation is the most fundamental LLM capability. You provide a prompt and the model generates a continuation or response.

### Controlling Output with Temperature

The **temperature** parameter controls how creative or deterministic the output is. A temperature of 0 produces the most predictable output. Higher temperatures (up to 1.0 or 2.0) produce more varied and creative output.

```typescript
// gemini_temperature.ts - Effect of temperature on text generation

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });
const prompt = "Write a one-sentence tagline for a coffee shop.";

for (const temp of [0.0, 1.5]) {
  const r = await ai.models.generateContent({
    model: "gemini-2.5-flash", contents: prompt, config: { temperature: temp },
  });
  console.log(`Temperature ${temp}: ${r.text}`);
}
```

For most practical applications, code generation, data extraction, question answering, use a low temperature (0.0 to 0.3). For creative writing and brainstorming, higher temperatures (0.7 to 1.5) produce more interesting results.


## Thinking Models

Some models can engage in extended internal reasoning before producing a response. Google's Gemini 2.5 Flash supports a **thinking budget** that controls how much computation the model devotes to reasoning through the problem before answering.

```typescript
// gemini_thinking.ts - Using Gemini's thinking mode

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const prompt = `
A farmer has a fox, a chicken, and a bag of grain. He needs to cross
a river in a boat that can only carry him and one item at a time.
If left alone, the fox will eat the chicken, and the chicken will eat
the grain. How does the farmer get everything across safely?
`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    thinkingConfig: {
      thinkingBudget: 1000,
    },
  },
});

console.log(response.text);
```

The thinking budget is specified in tokens. A budget of 0 disables thinking entirely (useful for simple tasks where speed matters). Higher budgets allow the model to reason through more complex problems but increase latency and cost.


## Multi-Turn Conversations

Real applications often involve multi-turn conversations where the model needs to remember previous exchanges. Both APIs support this by passing conversation history with each request.

```typescript
// gemini_conversation.ts - Multi-turn conversation with Gemini

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });
const conversation: { role: "user" | "model"; parts: { text: string }[] }[] = [];

async function chat(userMessage: string): Promise<string> {
  conversation.push({ role: "user", parts: [{ text: userMessage }] });
  const reply = (await ai.models.generateContent({
    model: "gemini-2.5-flash", contents: conversation,
  })).text ?? "";
  conversation.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

for (const q of [
  "What is the capital of France?",
  "What is its population?",
  "What are the top 3 tourist attractions there?",
]) {
  console.log(`Q: ${q}`);
  console.log("A:", await chat(q));
  console.log();
}
```

Notice that the second and third messages use pronouns ("its", "there") that only make sense given the conversation history. The model resolves these references correctly because it sees the full conversation with each request.


## Multimodal Input: Analyzing Images

Modern LLMs can process images alongside text. This enables applications like image description, document analysis, chart reading, and visual question answering.

```typescript
// gemini_image.ts - Analyzing an image with Gemini

import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

// Load an image from disk as base64
const imageBuffer = readFileSync("photo.jpg");
const base64Image = imageBuffer.toString("base64");

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        { text: "Describe what you see in this image." },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
      ],
    },
  ],
});

console.log(response.text);
```


## Structured Output

For many applications you need the model to return data in a specific format, JSON, CSV, or a particular schema. LLMs can be instructed to produce structured output through careful prompting.

```typescript
// gemini_structured.ts - Getting structured JSON output from Gemini

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const prompt = `Extract the following information from the text below and return
it as a JSON object with keys: "name", "company", "role", "years_experience".

Text: "Jane Smith has been working as a Senior Data Scientist at Acme Corp
for the past 7 years. She specializes in NLP and recommendation systems."
`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: { temperature: 0.0 },
});

const text = response.text ?? "";
const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
const result = JSON.parse(jsonStr);
console.log(JSON.stringify(result, null, 2));
```

Using temperature 0.0 is important for structured output, you want the model to be deterministic and precise rather than creative.


## Tool Use (Function Calling)

A limitation of plain text generation is that the model can only produce text, it cannot interact with the outside world. Function calling (also called tool use) bridges this gap. You provide the model with descriptions of available functions, and when the model determines that a function would help answer the user's question, it returns a structured function call instead of (or alongside) text. Your code executes the function and passes the result back to the model, which then incorporates it into its final response.

This pattern enables LLMs to look up real-time data, interact with databases, control external systems, and perform actions beyond text generation. Both Gemini and OpenAI support this capability.

### Gemini: Directory and File Tools

The Gemini example defines two tools: `list_directory` to list files in the current working directory, and `read_file` to read a file's contents. The model is asked to explore the project directory and summarize what it finds.

```typescript
// gemini_tools.ts - Gemini function calling with directory tools

import { GoogleGenAI } from "@google/genai";
import { readdir, readFile } from "node:fs/promises";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const tools = [
  {
    functionDeclarations: [
      {
        name: "list_directory",
        description: "List all files in the current working directory.",
      },
      {
        name: "read_file",
        description: "Read the contents of a file by name.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name of the file to read" },
          },
          required: ["filename"],
        },
      },
    ],
  },
];

const prompt = `Use the available tools to:
1. List the files in this directory.
2. Read the package.json file.
Then summarize what you find.`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: { tools },
});

for (const part of response.candidates?.[0]?.content?.parts ?? []) {
  if (part.text) {
    console.log(part.text);
  } else if (part.functionCall) {
    const { name, args } = part.functionCall;
    let result: string;
    if (name === "list_directory") {
      result = (await readdir(".")).join("\n");
    } else if (name === "read_file") {
      result = await readFile(args.filename as string, "utf-8");
    } else {
      result = "Unknown function";
    }

    const followUp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "model", parts: [{ functionCall: { name, args } }] },
        { role: "user", parts: [{ functionResponse: { name, response: { result } } }] },
      ],
    });
    console.log(followUp.text);
  }
}
```

With the Gemini SDK, tools are declared in the `config.tools` array using `functionDeclarations`. Each declaration specifies the function name, description, and optional parameter schema. The model does not execute the functions, it simply returns a `functionCall` part when it wants to invoke one. Your code is responsible for executing the function and sending the result back as a `functionResponse`.

Here is example output:

```
[Tool call: list_directory({})]


[Tool call: read_file({"filename":"package.json"})]

The directory contains several files, mostly TypeScript files related to `gemini` and `openai` APIs, along with `node_modules`, `package-lock.json`, and `package.json`.

The `package.json` file reveals the following:
*   **Name:** `llm-public-apis`
*   **Version:** `1.0.0`
*   **Type:** `module`
*   **Scripts:** It defines various scripts for running different tasks, including:
    *   `gemini`
    *   `openai`
    *   `temperature`
    *   `thinking`
    *   `conversation`
    *   `image`
    *   `structured`
    *   `gemini-tools`
    *   `openai-tools`
*   **Dependencies:**
    *   `@google/genai`: `^1.0.0`
    *   `openai`: `^4.77.0`
*   **Dev Dependencies:**
    *   `typescript`: `^5.7.0`
    *   `@types/node`: `^22.0.0`
    *   `tsx`: `^4.19.0`

In summary, this project is an LLM public APIs example project, version 1.0.0, utilizing both Google's Generative AI and OpenAI APIs, and built with TypeScript.
```


### OpenAI: Stubbed Weather API

The OpenAI example demonstrates the same pattern using a stubbed `get_weather` function. Rather than calling a real weather service, we return mock data, the focus is on the function calling mechanics.

```typescript
// openai_tools.ts - OpenAI function calling with stubbed weather API

import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from environment

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather conditions for a city.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature units",
          },
        },
        required: ["city"],
      },
    },
  },
];

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "user", content: "What's the weather in Paris? Also check London in fahrenheit." },
];

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
  tools,
});

const toolCalls = response.choices[0].message.tool_calls ?? [];
for (const call of toolCalls) {
  const args = JSON.parse(call.function.arguments);

  // Stubbed weather data
  const weather = {
    city: args.city,
    temperature: args.units === "fahrenheit" ? 72 : 22,
    conditions: "partly cloudy",
    humidity: "65%",
  };

  messages.push(response.choices[0].message);
  messages.push({
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify(weather),
  });
}

if (toolCalls.length > 0) {
  const followUp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });
  console.log(followUp.choices[0].message.content);
}
```

With the OpenAI SDK, tools are passed as `ChatCompletionTool` objects with the `type: "function"` discriminator. The model's response may contain `tool_calls`, which you process and follow up with `role: "tool"` messages carrying the results. The second call to `chat.completions.create` gives the model the tool outputs so it can produce its final answer.

The core loop is the same across both providers: describe the tools, let the model decide when to call them, execute the call, and feed the result back. For production applications, wrap this in a loop allowing the model to make multiple sequential function calls before producing its final response to the user.

Here is example output:

```
$ npx tsx openai_tools.ts
[Tool call: get_weather({"city":"Paris","units":"celsius"})]
{
  "city": "Paris",
  "temperature": 22,
  "conditions": "partly cloudy",
  "humidity": "65%"
}
[Tool call: get_weather({"city":"London","units":"fahrenheit"})]
{
  "city": "London",
  "temperature": 72,
  "conditions": "partly cloudy",
  "humidity": "65%"
}

The weather in Paris is partly cloudy with a temperature of 22°C and a humidity level of 65%. In London, it is also partly cloudy with a temperature of 72°F and the same humidity level of 65%.
```


## Practical Considerations

### Cost

API calls are billed per token. Input tokens (your prompt) and output tokens (the model's response) are priced separately, with output tokens typically costing 2-4x more. For most applications, start with a fast, inexpensive model and only upgrade to a frontier model for tasks that require it.

### Rate Limits

All API providers enforce rate limits. If you're building a production application, you'll need to implement retry logic with exponential backoff:

```typescript
async function generateWithRetry(
  ai: GoogleGenAI,
  prompt: string,
  maxRetries: number = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return response.text ?? "";
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const wait = 2 ** attempt * 1000;
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${wait}ms...`);
        await new Promise(resolve => setTimeout(resolve, wait));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Should not reach here");
}
```

### Privacy

Any data you send to an API is transmitted to the provider's servers. For sensitive data, review the provider's data usage policies carefully. For maximum privacy, consider using local models instead, as covered in the next chapter.


## Summary

Using LLMs through public APIs is the fastest path from idea to working application. The core pattern is simple across all providers: create a client, send a prompt, process the response. The richness comes from features like multi-turn conversations, multimodal input, web search, structured output, tool use, and thinking modes.

TypeScript is an excellent language for LLM API integration, the official SDKs from Google and OpenAI provide full type definitions, making it easy to discover capabilities and catch errors at compile time.

In the next chapter we cover the alternative approach: running open-weights models locally on your own hardware, which offers privacy, no per-token cost, and offline operation at the expense of model capability and the need for suitable hardware.


## Optional Practice Problems

Here are some exercises to help you practice integrating public LLM APIs into your TypeScript applications:

1. **Adaptive Temperature Sandbox**: Write a CLI tool (e.g., `compare_temp.ts`) that takes a single user prompt and generates three responses using different temperatures: `0.2` (focused), `0.7` (balanced), and `1.2` (creative). Compare and print the outputs, analyzing how the temperature level influences style, detail, and predictability.
2. **Robust JSON Validator and Auto-Retry**: Modify `gemini_structured.ts` to define a strict TypeScript interface for the expected JSON structure. Implement a parser wrapper that validates the parsed object. If the JSON structure is invalid or keys are missing, automatically retry the API request by appending the previous invalid output and a correction message to the history.
3. **Multimodal Image Inspector**: Create a CLI script that takes an image file and a specific question about the image (e.g., `"Count the number of items of type X"` or `"Is there any text in this image?"`). Run the request using Gemini's multimodal capabilities, and print a structured summary of the findings.
4. **Conversational Math Tutor with Reasoning**: Combine the concepts of multi-turn conversations (`gemini_conversation.ts`) and thinking mode (`gemini_thinking.ts`). Build a chat loop where the user presents a mathematical or logic puzzle. Configure the model to use thinking mode to solve the problem step-by-step internally, but instruct the model to only give the user a helpful hint rather than the final answer.
5. **CLI Shell Copilot via Tool Calling**: Build upon `gemini_tools.ts` or `openai_tools.ts` by introducing a tool called `execute_safe_command` (which runs a shell command and returns its output, restricted to safe commands like `git status`, `npm run build`, or `npm test`). Ask the model to fix a linting error or run a compilation command and report the output, executing a recursive tool-calling loop until the command passes.
