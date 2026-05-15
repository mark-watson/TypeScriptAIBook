// ollama_memory.ts - Conversation with persistent memory

import ollama from "ollama";

type Msg = { role: "system" | "user" | "assistant"; content: string };

class LocalAssistant {
  private messages: Msg[] = [];
  constructor(private model: string = "llama3.2:3b", systemPrompt = "") {
    if (systemPrompt) this.messages.push({ role: "system", content: systemPrompt });
  }
  async chat(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage });
    const reply = (await ollama.chat({ model: this.model, messages: this.messages })).message.content;
    this.messages.push({ role: "assistant", content: reply });
    return reply;
  }
  get messageCount() { return this.messages.length; }
}

const assistant = new LocalAssistant(
  "llama3.2:3b",
  "You are a concise technical writing assistant. Keep answers under 3 sentences.",
);

for (const q of [
  "What is gradient descent?",
  "How does the learning rate affect it?",
  "What happens if I set it too high?",
]) {
  console.log(`Q: ${q}`);
  console.log("A:", await assistant.chat(q));
  console.log();
}
console.log(`(Conversation has ${assistant.messageCount} messages)`);
