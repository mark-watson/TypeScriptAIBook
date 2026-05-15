// ollama_describe-image.ts - Send images to Ollama vision models for description

import ollama from "ollama";
import { readFileSync, existsSync } from "fs";

const MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:0.8b";
const HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

async function imageToText(
  imagePaths: string | string[], prompt: string,
  model = MODEL, host = HOST,
): Promise<string> {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  for (const p of paths) if (!existsSync(p)) throw new Error(`Image file not found: ${p}`);
  const images = paths.map(p => readFileSync(p).toString("base64"));
  const response = await ollama.chat({ model, messages: [{ role: "user", content: prompt, images }], host });
  return response.message.content;
}

const [,, imageArg, ...promptArgs] = process.argv;
const result = await imageToText(
  imageArg ?? "ticket.png",
  promptArgs.length > 0 ? promptArgs.join(" ") : "Print out the plain text in this image",
);
console.log(result);
