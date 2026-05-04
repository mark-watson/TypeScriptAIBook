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
console.log();
