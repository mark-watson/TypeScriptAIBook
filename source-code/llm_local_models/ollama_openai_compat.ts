// ollama_openai_compat.ts - Using local Ollama with the OpenAI SDK

import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "not-needed",
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
