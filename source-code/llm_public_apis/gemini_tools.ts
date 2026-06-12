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

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: { tools },
});

let text = "";
for (const part of response.candidates?.[0]?.content?.parts ?? []) {
  if (part.text) {
    console.log(part.text);
    text += part.text;
  } else if (part.functionCall) {
    const { name, args } = part.functionCall;
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

    const followUp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        {
          role: "model",
          parts: [{ functionCall: { name, args } }],
        },
        {
          role: "user",
          parts: [{ functionResponse: { name, response: { result } } }],
        },
      ],
    });
    console.log(followUp.text);
  }
}
