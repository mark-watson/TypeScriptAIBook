# LLMs with Public APIs

The fastest way to use large language models is through cloud APIs. Google, OpenAI, and Anthropic all offer APIs that give you access to their most capable models with just a few lines of TypeScript code. You don't need a GPU, you don't need to download model weights, and you can start building applications in minutes.

In this chapter we work through practical examples using the Google Gemini API and the OpenAI API. Both provide TypeScript/JavaScript client libraries that handle authentication, request formatting, and response parsing. The patterns you learn here apply to other API providers as well — the core concepts of sending prompts, receiving completions, and managing conversations are the same across providers.

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

Here is the simplest possible example — send a prompt to Gemini and print the response:

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

For most practical applications — code generation, data extraction, question answering — use a low temperature (0.0 to 0.3). For creative writing and brainstorming, higher temperatures (0.7 to 1.5) produce more interesting results.


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

For many applications you need the model to return data in a specific format — JSON, CSV, or a particular schema. LLMs can be instructed to produce structured output through careful prompting.

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

Using temperature 0.0 is important for structured output — you want the model to be deterministic and precise rather than creative.


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

Using LLMs through public APIs is the fastest path from idea to working application. The core pattern is simple across all providers: create a client, send a prompt, process the response. The richness comes from features like multi-turn conversations, multimodal input, web search, structured output, and thinking modes.

TypeScript is an excellent language for LLM API integration — the official SDKs from Google and OpenAI provide full type definitions, making it easy to discover capabilities and catch errors at compile time.

In the next chapter we cover the alternative approach: running open-weights models locally on your own hardware, which offers privacy, no per-token cost, and offline operation at the expense of model capability and the need for suitable hardware.

