import { NeuralNetwork } from './nn';

// Simple XOR problem
const inputs = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1]
];

const targets = [
  [0],
  [1],
  [1],
  [0]
];

// Input size: 2, Hidden sizes: [4, 4], Output size: 1
const nn = new NeuralNetwork(2, [4, 4], 1, 0.5);

console.log("Training...");
for (let i = 0; i < 10000; i++) {
  nn.train(inputs, targets);
}

console.log("Predictions:");
inputs.forEach((input, index) => {
  const prediction = nn.predict(input);
  console.log(`Input: ${JSON.stringify(input)} -> Prediction: ${prediction[0].toFixed(4)}`);
});