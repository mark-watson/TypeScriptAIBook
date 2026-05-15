// gemini_thinking.ts - Using Gemini's thinking mode

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `A farmer has a fox, a chicken, and a bag of grain. He needs to cross
a river in a boat that can only carry him and one item at a time.
If left alone, the fox will eat the chicken, and the chicken will eat
the grain. How does the farmer get everything across safely?`,
  config: { thinkingConfig: { thinkingBudget: 1000 } },
});
console.log(response.text);
