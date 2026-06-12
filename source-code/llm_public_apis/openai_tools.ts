// openai_tools.ts - OpenAI function calling with stubbed weather API

import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from environment

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather conditions for a city.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature units",
          },
        },
        required: ["city"],
      },
    },
  },
];

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "user", content: "What's the weather in Paris? Also check London in fahrenheit." },
];

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
  tools,
});

const toolCalls = response.choices[0].message.tool_calls ?? [];
for (const call of toolCalls) {
  const args = JSON.parse(call.function.arguments);
  console.log(`[Tool call: get_weather(${JSON.stringify(args)})]`);

  // Stubbed weather data — no real API call
  const weather = {
    city: args.city,
    temperature: args.units === "fahrenheit" ? 72 : 22,
    conditions: "partly cloudy",
    humidity: "65%",
  };
  console.log(JSON.stringify(weather, null, 2));

  messages.push(response.choices[0].message);
  messages.push({
    role: "tool",
    tool_call_id: call.id,
    content: JSON.stringify(weather),
  });
}

if (toolCalls.length > 0) {
  const followUp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });
  console.log("\n" + followUp.choices[0].message.content);
}
