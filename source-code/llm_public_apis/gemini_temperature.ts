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
