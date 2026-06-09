# Simple Neural Network in TypeScript

A lightweight, from-scratch implementation of a feedforward neural network using TypeScript. This project demonstrates the core concepts of neural networks, including layers, forward propagation, backpropagation, and training on a classic XOR problem.

## Features

- **Layer Class**: Handles weight initialization, sigmoid activation functions, forward passes, and backward propagation for individual layers.
- **NeuralNetwork Class**: Orchestrates multiple layers to form a complete network, providing methods for prediction and training.
- **Backpropagation**: Implements the chain rule to update weights and biases based on error gradients.

## Project Structure

- `nn.ts`: Contains the core logic of the neural network, including the `Layer` and `NeuralNetwork` classes.
- `test.ts`: A script that initializes a neural network with two hidden layers (4 neurons each) to solve the XOR problem and prints the training results.

## Getting Started

### Prerequisites

Ensure you have Node.js and npm installed on your system. You will also need `tsx` for running TypeScript files directly.

```bash
npm install -g tsx
```

### Running the Project

To run the test script and see the neural network in action, execute:

```bash
npx tsx test.ts
```

## Example Output

When running the project, you will see the training process and the final predictions for the XOR inputs:

```text
Training...
Predictions:
Input: [0,0] -> Prediction: 0.0105
Input: [0,1] -> Prediction: 0.9908
Input: [1,0] -> Prediction: 0.9777
Input: [1,1] -> Prediction: 0.0167
```

## Technical Details

- **Activation Function**: Sigmoid ($\sigma(x) = \frac{1}{1 + e^{-x}}$).
- **Weight Initialization**: Random values between -1 and 1.
- **Training Loop**: The network is trained for 10,000 iterations on the XOR dataset with a learning rate of 0.5.
