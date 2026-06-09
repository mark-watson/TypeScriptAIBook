/**
 * A simple neural network implementation from scratch.
 */

type Matrix = number[][];

class Layer {
  weights: Matrix;
  biases: number[];
  derivatives: Matrix; // For backprop, we'll store the activations of the previous layer
  activations: number[]; // Current layer output

  constructor(inputSize: number, outputSize: number) {
    // Initialize weights with small random values
    this.weights = Array.from({ length: outputSize }, () =>
      Array.from({ length: inputSize }, () => Math.random() * 2 - 1)
    );
    this.biases = new Array(outputSize).fill(0);
  }

  /**
   * Sigmoid activation function
   */
  static sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  forward(inputs: number[]): number[] {
    this.activations = this.weights.map((wRow, i) => {
      let sum = 0;
      for (let j = 0; j < wRow.length; j++) {
        sum += wRow[j] * inputs[j];
      }
      return Layer.sigmoid(sum + this.biases[i]);
    });
    return this.activations;
  }

  /**
   * Backpropagation step for a single layer
   * @param errors The errors from the next layer (delta)
   * @param learningRate The learning rate to apply during weight updates
   */
  backward(errors: number[], learningRate: number): number[] {
    const inputs = this.derivatives; // This will be set by the network during forward pass
    const nextErrors = new Array(this.weights[0].length).fill(0);

    for (let i = 0; i < this.weights.length; i++) {
      // The derivative of sigmoid(x) is sigmoid(x) * (1 - sigmoid(x))
      // Since this.activations[i] is already sigmoid(sum + bias), we use it directly.
      const delta = errors[i] * (this.activations[i] * (1 - this.activations[i]));
      
      // Update weights and biases
      for (let j = 0; j < this.weights[i].length; j++) {
        nextErrors[j] += this.weights[i][j] * delta;
        this.weights[i][j] += learningRate * delta * inputs[j];
      }
      this.biases[i] += learningRate * delta;
    }

    return nextErrors;
  }
}

export class NeuralNetwork {
  layers: Layer[];
  learningRate: number;

  constructor(inputSize: number, hiddenSizes: number[], outputSize: number, learningRate: number = 0.1) {
    this.layers = [];
    let prevSize = inputSize;

    for (const size of hiddenSizes) {
      this.layers.push(new Layer(prevSize, size));
      prevSize = size;
    }

    this.layers.push(new Layer(prevSize, outputSize));
    this.learningRate = learningRate;
  }

  predict(inputs: number[]): number[] {
    let currentInputs = inputs;
    for (const layer of this.layers) {
      // Store the input to this layer as derivatives for backprop
      layer.derivatives = [...currentInputs];
      currentInputs = layer.forward(currentInputs);
    }
    return currentInputs;
  }

  train(inputs: number[][], targets: number[][]) {
    for (let i = 0; i < inputs.length; i++) {
      const output = this.predict(inputs[i]);
      
      // Calculate error at the output layer
      const errors = output.map((out, idx) => targets[i][idx] - out);
      
      // Backpropagate
      let currentErrors = errors;
      for (let j = this.layers.length - 1; j >= 0; j--) {
        currentErrors = this.layers[j].backward(currentErrors, this.learningRate);
      }
    }
  }
}
