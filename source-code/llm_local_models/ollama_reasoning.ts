// ollama_reasoning.ts - Chain-of-thought reasoning with DeepSeek-R1

import ollama from "ollama";

async function reasonAbout(
  question: string,
  model: string = "deepseek-r1:7b"
): Promise<{ reasoning: string; answer: string }> {
  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: question }],
  });

  const content = response.message.content;

  let reasoning = "";
  let answer = content;

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    reasoning = thinkMatch[1].trim();
    answer = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  }

  return { reasoning, answer };
}

const question =
  "A bakery sells 3 types of bread. Each type comes in 2 sizes. " +
  "How many different bread options are available? " +
  "Respond with just the number and a brief explanation.";

const result = await reasonAbout(question);

if (result.reasoning) {
  console.log("=== Reasoning ===");
  console.log(result.reasoning);
  console.log();
}

console.log("=== Answer ===");
console.log(result.answer);
