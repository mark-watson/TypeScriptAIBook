# Graph Search Example

This project provides a simple implementation of a graph data structure in TypeScript, featuring nodes with notes and directed edges between them. It includes a Depth First Search (DFS) algorithm to find paths between specific nodes.

## Features

- **Node Representation**: Each node has a unique identifier and an associated note.
- **Adjacency List**: Efficiently manages connections between nodes.
- **Depth First Search (DFS)**: A recursive implementation that finds the first available path from a start node to a goal node, handling cycles gracefully using a visited set.
- **Example Usage**: Includes a pre-configured graph with multiple paths and cycles to demonstrate functionality.

## Setup

```bash
npm install
```

## Run

```bash
npx tsx graph.ts
```

## Example Output

When running the script, you will see the current structure of the graph and the result of the DFS search:

```text
Current Graph Structure:
Nodes:
 - A: Start Node
 - B: Intermediate Node 1
 - C: Intermediate Node 2
 - D: Goal Node
 - E: Dead End
Edges:
 - A -> B, C
 - B -> D
 - C -> E
 - E -> B

Searching for path from A to D...
Path found: A -> B -> D
```
