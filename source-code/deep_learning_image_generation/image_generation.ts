// image_generation.ts - Generate images via Hugging Face Inference API

import { HfInference } from "@huggingface/inference";
import { writeFileSync } from "node:fs";

async function main() {
  const token = process.env.HF_TOKEN;
  if (!token) {
    console.error("Please set the HF_TOKEN environment variable");
    process.exit(1);
  }

  const hf = new HfInference(token);

  const prompt = "a serene mountain landscape at sunset, oil painting style";
  console.log(`Generating image for prompt: '${prompt}'`);

  const image = await hf.textToImage({
    model: "stabilityai/stable-diffusion-xl-base-1.0",
    inputs: prompt,
    parameters: {
      num_inference_steps: 25,
    },
  });

  const buffer = Buffer.from(await image.arrayBuffer());
  writeFileSync("generated_landscape.png", buffer);
  console.log("Image saved to: generated_landscape.png");
}

main();
