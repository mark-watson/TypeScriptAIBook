// frame.ts - Implement Lisp-like frames in TypeScript

class Frame {
  private static frameCounter = 0;
  private objects: (Frame | number | string)[] = [];
  private depth = 0;
  public readonly name: string;

  constructor(name: string = "") {
    Frame.frameCounter++;
    this.name = name ? `"${name}"` : `Frame:${Frame.frameCounter}`;
  }

  addSubframe(frame: Frame): void {
    frame.depth = this.depth + 1;
    this.objects.push(frame);
  }

  addNumber(n: number): void {
    this.objects.push(n);
  }

  addString(s: string): void {
    this.objects.push(s);
  }

  toString(): string {
    const indent = "  ".repeat(this.depth);
    let ret = `${indent}<Frame ${this.name}>\n`;
    for (const obj of this.objects) {
      if (typeof obj === "number") {
        ret += `${indent}  <Number ${obj}>\n`;
      } else if (typeof obj === "string") {
        ret += `${indent}  <String "${obj}">\n`;
      } else if (obj instanceof Frame) {
        ret += obj.toString();
      }
    }
    return ret;
  }
}

class BookShelf {
  private frames: Frame[] = [];

  addFrame(frame: Frame): void {
    this.frames.push(frame);
  }

  searchText(searchString: string): Frame[] {
    return this.frames.filter(frame =>
      frame.toString().includes(searchString)
    );
  }
}

// --- Demo ---
const f1 = new Frame();
const f2 = new Frame("a sub-frame");
f1.addSubframe(f2);
f1.addNumber(3.14);
f2.addString("a string");
console.log(f1.toString());

f2.addSubframe(new Frame("a sub-sub-frame"));
console.log(f1.toString());

const bookshelf = new BookShelf();
bookshelf.addFrame(f1);
const searchResults = bookshelf.searchText("sub");
console.log("Search results: all frames containing 'sub':");
for (const rs of searchResults) {
  console.log(rs.toString());
}
