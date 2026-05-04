// gemini_conversation.ts - Multi-turn conversation with Gemini

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

interface Message {
  role: "user" | "model";
  parts: { text: string }[];
}

const conversation: Message[] = [];

async function chat(userMessage: string): Promise<string> {
  conversation.push({ role: "user", parts: [{ text: userMessage }] });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: conversation,
  });

  const reply = response.text ?? "";
  conversation.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

console.log("Q: What is the capital of France?");
console.log("A:", await chat("What is the capital of France?"));
console.log();
console.log("Q: What is its population?");
console.log("A:", await chat("What is its population?"));
console.log();
console.log("Q: What are the top 3 tourist attractions there?");
console.log("A:", await chat("What are the top 3 tourist attractions there?"));
