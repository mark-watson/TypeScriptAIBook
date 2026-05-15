// ollama_reasoning.ts - Chain-of-thought reasoning with DeepSeek-R1

import ollama from "ollama";

async function reasonAbout(question: string, model = "deepseek-r1:7b") {
  const content = (await ollama.chat({ model, messages: [{ role: "user", content: question }] })).message.content;
  const m = content.match(/<think>([\s\S]*?)<\/think>/);
  return {
    reasoning: m?.[1].trim() ?? "",
    answer: m ? content.replace(/<think>[\s\S]*?<\/think>/, "").trim() : content,
  };
}

const { reasoning, answer } = await reasonAbout(
  "A bakery sells 3 types of bread. Each type comes in 2 sizes. " +
  "How many different bread options are available? " +
  "Respond with just the number and a brief explanation.",
);

if (reasoning) console.log("=== Reasoning ===\n" + reasoning + "\n");
console.log("=== Answer ===\n" + answer);
