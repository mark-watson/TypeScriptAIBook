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

const assistant = new LocalAssistant(
  "llama3.2:3b",
  "You are a concise technical writing assistant. Keep answers under 3 sentences."
);

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
