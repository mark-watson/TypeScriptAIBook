// gemini_image.ts - Analyzing an image with Gemini

import { GoogleGenAI } from "@google/genai";
import { readFileSync, existsSync } from "node:fs";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const imagePath = process.argv[2] || "photo.jpg";
if (!existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}\nUsage: tsx gemini_image.ts <path-to-image>`);
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const base64Image = readFileSync(imagePath).toString("base64");
const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpeg";

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [{
    role: "user",
    parts: [
      { text: "Describe what you see in this image." },
      { inlineData: { mimeType: ext === "png" ? "image/png" : "image/jpeg", data: base64Image } },
    ],
  }],
});
console.log(response.text);
