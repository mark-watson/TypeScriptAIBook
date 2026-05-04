// gemini_text.ts - Basic text generation with Google Gemini

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Briefly explain what a transformer model is in AI.",
});

console.log(response.text);
