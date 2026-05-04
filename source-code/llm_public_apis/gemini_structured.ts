// gemini_structured.ts - Getting structured JSON output from Gemini

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

const prompt = `Extract the following information from the text below and return
it as a JSON object with keys: "name", "company", "role", "years_experience".

Text: "Jane Smith has been working as a Senior Data Scientist at Acme Corp
for the past 7 years. She specializes in NLP and recommendation systems."
`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: { temperature: 0.0 },
});

const text = response.text ?? "";
const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
try {
  const result = JSON.parse(jsonStr);
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.log("Raw response:", text);
}
