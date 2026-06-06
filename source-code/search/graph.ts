/**
 * Represents a node in the graph structure.
 * Each node is uniquely identified by an ID and can have an optional note.
 */
interface Node {
  /** Unique identifier for the node (e.g., "A", "B"). */
  id: string;
  /** A descriptive label or information associated with the node. */
  note: string;
}

/**
 * Represents an edge between two nodes.
 */
interface Edge {
  from: string;
  to: string;
}

/**
 * A simple Graph data structure.
 */
class Graph {
  /**
   * A collection of all nodes in the graph, mapped by their unique IDs.
   */
  private nodes: Map<string, Node> = new Map();
  private adjacencyList: Map<string, string[]> = new Map();

  /**
   * Adds a new node to the graph and initializes its entry in the adjacency list.
   * 
   * @param id - The unique identifier for the new node.
   * @param note - A description or metadata for the node.
   */
  addNode(id: string, note: string): void {
    this.nodes.set(id, { id, note });
    if (!this.adjacencyList.has(id)) {
      this.adjacencyList.set(id, []);
    }
  }

  /**
   * Adds a directed edge from one node to another.
   */
  addEdge(from: string, to: string): void {
    if (this.nodes.has(from) && this.nodes.has(to)) {
      this.adjacencyList.get(from)?.push(to);
    } else {
      console.error(`Error: One or both nodes (${from}, ${to}) do not exist.`);
    }
  }

  /**
   * Performs a Depth First Search (DFS) to find a path from startNode to goalNode.
   * @returns The path as an array of node IDs, or null if no path exists.
   */
  findPathDFS(startNode: string, goalNode: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (currentId: string): boolean => {
      visited.add(currentId);
      path.push(currentId);

      if (currentId === goalNode) {
        return true;
      }

      const neighbors = this.adjacencyList.get(currentId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        }
      }

      path.pop(); // Backtrack
      return false;
    };

    if (!this.nodes.has(startNode) || !this.nodes.has(goalNode)) {
      console.error("Error: Start or goal node does not exist.");
      return null;
    }

    const success = dfs(startNode);
    return success ? path : null;
  }

  /**
   * Prints the current graph structure for debugging.
   */
  printGraph(): void {
    console.log("Nodes:");
    this.nodes.forEach((node) => {
      console.log(` - ${node.id}: ${node.note}`);
    });
    console.log("Edges:");
    this.adjacencyList.forEach((neighbors, from) => {
      console.log(` - ${from} -> ${neighbors.join(", ")}`);
    });
  }
}

// --- Example Usage ---

const myGraph = new Graph();

// Set up example graph data
myGraph.addNode("A", "Start Node");
myGraph.addNode("B", "Intermediate Node 1");
myGraph.addNode("C", "Intermediate Node 2");
myGraph.addNode("D", "Goal Node");
myGraph.addNode("E", "Dead End");

// Set up edges
myGraph.addEdge("A", "B");
myGraph.addEdge("A", "C");
myGraph.addEdge("B", "D");
myGraph.addEdge("C", "E");
myGraph.addEdge("E", "B"); // Cycle example

console.log("Current Graph Structure:");
myGraph.printGraph();

const start = "A";
const goal = "D";
console.log(`\nSearching for path from ${start} to ${goal}...`);

const resultPath = myGraph.findPathDFS(start, goal);

if (resultPath) {
  console.log("Path found:", resultPath.join(" -> "));
} else {
  console.log("No path found.");
}
