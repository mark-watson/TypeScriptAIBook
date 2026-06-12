# Symbolic AI

When I started my paid career as an AI practitioner in 1982 my company bought me a Xerox 1108 Lisp Machine and I spent every spare moment I had working through two books by Patrick Winston that I had purchased a few years earlier: "Lisp" and "Artificial Intelligence." This material was mostly what is now called symbolic AI or good old fashioned AI (GOFAI). The material in this chapter is optional for modern AI developers but I recently wrote the TypeScript examples listed below when I was thinking of how different knowledge representation is today compared to 40 years ago. After this chapter we will bear down on knowledge representation using RDF and property graph data stores.

The material in this chapter is optional for the modern AI practitioner but I hope you find it interesting.

The examples for this chapter are in the directory **source-code/symbolic-AI**.

{width: "80%"}
![Architecture diagram for frame data structures and MiniZinc constraint programming](FIG_symbolic-AI.jpg)


## Comparison of Symbolic AI and Deep Learning

Symbolic AI, also known as "good old-fashioned AI" (GOFAI), is a form of artificial intelligence that uses symbolic representations and logical reasoning to solve problems. It is based on the idea that a computer can be programmed to manipulate symbols in the same way that humans manipulate symbols in their minds: an example of this is the process of logical reasoning.

Symbolic AI systems can consist of sets of rules, facts, and procedures that are used to represent knowledge and a reasoning engine that uses these symbolic representations to make inferences and decisions. Some examples of symbolic AI systems include expert systems, other types of rule-based systems, and decision trees. These systems are typically based on a set of predefined rules and the performance of the system is based on the knowledge manually encoded (or it can be learned) in these rules. Symbolic AI is largely non-numerical.

In comparison deep learning, which uses numerical representations (high dimensional matrices, or tensors, containing floating point data), is a subset of machine learning that uses neural networks with many multiple layers to learn from data and make predictions or decisions.

The key difference is that, while Symbolic AI relies on hand-coded rules and logical reasoning, deep learning relies on learning from data. Symbolic AI systems typically have a high level of interpretability and transparency, as the rules and knowledge are explicitly encoded and can be inspected by humans, while deep learning models are often considered "black boxes" due to their complexity and the difficulty of understanding how they arrived at a decision.


## Implementing Frame Data Structures in TypeScript

Most of my learning experiments and AI projects in the early 1980s were built from scratch in Common Lisp and nested frame data structures were a common building block. Here we allow three types of data to be stored in frames:

- Numbers
- Strings
- Other frames

We write a general TypeScript class **Frame** that supports creating frames and converting a frame, including deeply nested frames, into a string representation. We also write a simple TypeScript class **BookShelf** as a container for frames that supports searching for any frames containing a string value.

```typescript
// frame.ts - Implement Lisp-like frames in TypeScript

class Frame {
  private static counter = 0;
  private objects: (Frame | number | string)[] = [];
  private depth = 0;
  readonly name: string;

  constructor(name = "") { this.name = name ? `"${name}"` : `Frame:${++Frame.counter}`; }

  addSubframe(f: Frame) { f.depth = this.depth + 1; this.objects.push(f); }
  addNumber(n: number) { this.objects.push(n); }
  addString(s: string) { this.objects.push(s); }

  toString(): string {
    const pad = "  ".repeat(this.depth);
    return `${pad}<Frame ${this.name}>\n` + this.objects.map(o =>
      o instanceof Frame ? o.toString() :
      typeof o === "number" ? `${pad}  <Number ${o}>\n` :
      `${pad}  <String "${o}">\n`
    ).join("");
  }
}

class BookShelf {
  private frames: Frame[] = [];
  addFrame(f: Frame) { this.frames.push(f); }
  searchText(s: string) { return this.frames.filter(f => f.toString().includes(s)); }
}

// --- Demo ---
const f1 = new Frame(), f2 = new Frame("a sub-frame");
f1.addSubframe(f2); f1.addNumber(3.14); f2.addString("a string");
console.log(f1.toString());

f2.addSubframe(new Frame("a sub-sub-frame"));
console.log(f1.toString());

const shelf = new BookShelf();
shelf.addFrame(f1);
console.log("Search results: all frames containing 'sub':");
for (const r of shelf.searchText("sub")) console.log(r.toString());
```

The implementation of the class **Frame** is straightforward. The constructor defines a list of contained objects (or frames), sets the default frame nesting depth to zero, and assigns a readable name. There are three separate methods to add subframes, numbers, and strings.

The method **toString** ensures that when we print a frame that the output is human readable and visualizes frame nesting.

Here is some output:

```
$ tsx frame.ts
<Frame Frame:1>
  <Frame "a sub-frame">
    <String "a string">
  <Number 3.14>

<Frame Frame:1>
  <Frame "a sub-frame">
    <String "a string">
    <Frame "a sub-sub-frame">
  <Number 3.14>

Search results: all frames containing 'sub':
<Frame Frame:1>
  <Frame "a sub-frame">
    <String "a string">
    <Frame "a sub-sub-frame">
  <Number 3.14>
```

I no longer use frames, preferring the use of off the shelf graph databases that we will cover in a later chapter. Graphs can represent a wider range of data representations because frames represent tree structured data and graphs are more general purpose than trees.


## Constraint Programming with MiniZinc and TypeScript

Our excursion into constraint programming will be brief, hopefully enough to introduce you to a new style of programming through a few examples. I still use constraint programming and hope you might find the material in this section useful.

Constraint Programming (CP) is a paradigm of problem-solving that involves specifying the constraints of a problem, and then searching for solutions that satisfy those constraints. MiniZinc is a high-level modeling language for constraint programming.

### Installation and Setup

You need to first install the MiniZinc system. For macOS this can be done with:

```bash
brew install minizinc
```

We call MiniZinc from TypeScript using Node.js child processes.

### A Simple Example

Here is a MiniZinc source file **test_mzn.mzn**:

```python
int: n;
int: m;
var 1..n: x;
var 1..n: y;
constraint x+y = n;
constraint x*y = m;
```

And here is the TypeScript script that calls MiniZinc:

```typescript
// test_mzn.ts - Calling MiniZinc from TypeScript

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

function solveMiniZinc(modelFile: string, params: Record<string, number>): string {
  const paramFile = "params.dzn";
  writeFileSync(paramFile, Object.entries(params).map(([k, v]) => `${k} = ${v};`).join("\n"));
  try {
    return execSync(`minizinc --solver coinbc ${modelFile} ${paramFile}`, { encoding: "utf-8", timeout: 30000 }).trim();
  } finally { try { unlinkSync(paramFile); } catch {} }
}

console.log(solveMiniZinc("test_mzn.mzn", { n: 30, m: 200 }));
```

The output is:

```bash
$ tsx test_mzn.ts
x = 20;
y = 10;
----------
```

### The Map Coloring Problem

A more complex example: coloring the map of the USA so that no two neighboring states share a color. The MiniZinc model declares a variable for each state and constraints for each border:

```python
int: nc = 4;

var 1..nc: alabama;
var 1..nc: alaska;
var 1..nc: arizona;
...
constraint alabama != florida;
constraint alabama != georgia;
constraint alabama != mississippi;
...
solve satisfy;
```

We can call this from TypeScript the same way:

```bash
$ tsx us_states.ts
alabama = 2
alaska = 1
arizona = 3
arkansas = 4
...
```


## Symbolic AI Wrap-up

As a practical matter almost all of my work in the last ten years used either deep learning or was comprised of a combination of semantic web and linked data with deep learning projects. While the material in this chapter is optional for the modern AI practitioner, I still find using MiniZinc for constraint programming to be useful. I included the frame implementation because I both find it interesting and I believe that any future development of "real AI" (or AGI) will involve hybrid approaches combining symbolic and neural methods.

In the TypeScript version of this book, we omitted the Swi-Prolog and Soar Cognitive Architecture examples from the Python edition. These tools have Python bindings but lack mature TypeScript/JavaScript integrations. If you are interested in logic programming from TypeScript, consider exploring embedded Prolog interpreters or using Ollama with a local model as a reasoning engine, the results are surprisingly good for many tasks that traditionally required symbolic reasoners.

