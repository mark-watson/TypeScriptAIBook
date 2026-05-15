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
