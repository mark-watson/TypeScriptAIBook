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
