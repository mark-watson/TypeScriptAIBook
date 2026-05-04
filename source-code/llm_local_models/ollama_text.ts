// ollama_text.ts - Basic text generation with a local model

import ollama from "ollama";

const response = await ollama.chat({
  model: "llama3.2:3b",
  messages: [
    { role: "user", content: "Briefly explain what a neural network is." },
  ],
});

console.log(response.message.content);
