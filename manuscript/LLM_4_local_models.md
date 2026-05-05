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

