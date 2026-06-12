// gemini_tools.ts - Gemini function calling with directory tools

import { GoogleGenAI } from "@google/genai";
import { readdir, readFile } from "node:fs/promises";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("Set GOOGLE_API_KEY"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

const tools = [
  {
    functionDeclarations: [
      {
        name: "list_directory",
        description: "List all files in the current working directory.",
      },
      {
        name: "read_file",
        description: "Read the contents of a file by name.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name of the file to read" },
          },
          required: ["filename"],
        },
      },
    ],
  },
];

const prompt = `Use the available tools to:
1. List the files in this directory.
2. Read the package.json file.
Then summarize what you find.`;

const contents: any[] = [
  { role: "user", parts: [{ text: prompt }] },
];

let response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents,
  config: { tools },
});

while (true) {
  const candidate = response.candidates?.[0];
  const modelContent = candidate?.content;
  if (!modelContent) {
    break;
  }

  const functionCalls = modelContent.parts?.filter(p => p.functionCall) ?? [];
  if (functionCalls.length === 0) {
    if (response.text) {
      console.log(response.text);
    }
    break;
  }

  const textParts = modelContent.parts?.filter(p => p.text) ?? [];
  for (const part of textParts) {
    if (part.text) {
      console.log(part.text);
    }
  }

  // 1. Add model response (with the function calls) to the conversation history
  contents.push(modelContent);

  // 2. Execute all function calls and gather their responses
  const responseParts = [];
  for (const part of functionCalls) {
    const { name, args } = part.functionCall!;
    console.log(`\n[Tool call: ${name}(${JSON.stringify(args)})]\n`);

    let result: string;
    if (name === "list_directory") {
      const files = await readdir(".");
      result = files.join("\n");
    } else if (name === "read_file") {
      result = await readFile(args.filename as string, "utf-8");
    } else {
      result = "Unknown function";
    }

    responseParts.push({
      functionResponse: {
        name,
        response: { result },
      },
    });
  }

  // 3. Add user response (with the function results) to the conversation history
  contents.push({
    role: "user",
    parts: responseParts,
  });

  // 4. Send the updated contents back to the model
  response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: { tools },
  });
}
