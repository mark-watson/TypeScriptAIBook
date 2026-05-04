// summarization.ts - Text summarization with a local transformer model

import { pipeline } from "@huggingface/transformers";

async function main() {
  console.log("Loading summarization model...");
  const summarizer = await pipeline("summarization", "Xenova/distilbart-cnn-6-6");

  const text =
    "The President sent a request for changing the debt ceiling to " +
    "Congress. The president might call a press conference. The Congress " +
    "was not oblivious of what the Supreme Court's majority had ruled on " +
    "budget matters. Even four Justices had found nothing to criticize in " +
    "the President's requirement that the Federal Government's four-year " +
    "spending plan. It is unclear whether or not the President and " +
    "Congress can come to an agreement before Congress recesses for a " +
    "holiday. There is major disagreement between the Democratic and " +
    "Republican parties on spending.";

  console.log(`\nOriginal text (${text.split(" ").length} words):`);
  console.log(text.slice(0, 70) + "...\n");

  const result = await summarizer(text, { max_length: 60, num_beams: 4 });
  console.log("Summary:");
  console.log((result as any)[0].summary_text);
}

main();
