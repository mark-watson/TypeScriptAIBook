// ollama_describe-image.ts - Send images to Ollama vision models for description
//
// Usage:
//   tsx ollama_describe-image.ts
//
// Environment:
//   OLLAMA_MODEL — optional model override (default: qwen3.5:0.8b)
//   OLLAMA_HOST  — optional API host override (default: http://localhost:11434)

import ollama from "ollama";
import { readFileSync, existsSync } from "fs";

const MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:0.8b";
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

function encodeImage(imagePath: string): string {
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  return readFileSync(imagePath).toString("base64");
}

async function imageToText(
  imagePaths: string | string[],
  prompt: string,
  model: string = MODEL,
  host: string = HOST
): Promise<string> {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  for (const p of paths) {
    if (!existsSync(p)) {
      throw new Error(`Image file not found: ${p}`);
    }
  }
  const images = paths.map(encodeImage);
  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: prompt, images }],
    host,
  });
  return response.message.content;
}

async function describeImageSimple(imagePath: string): Promise<string> {
  return imageToText(imagePath, "What is in this image?");
}

const [,, imageArg, ...promptArgs] = process.argv;
const imagePath = imageArg ?? "ticket.png";
const promptText = promptArgs.length > 0 ? promptArgs.join(" ") : "Print out the plain text in this image";

const result = await imageToText(imagePath, promptText);
console.log(result);
