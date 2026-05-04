// openai_text.ts - Basic text generation with OpenAI

import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from environment

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Briefly explain what a transformer model is in AI." },
  ],
});

console.log(response.choices[0].message.content);
