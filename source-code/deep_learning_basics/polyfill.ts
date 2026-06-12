import util from "node:util";

// Polyfill util.isNullOrUndefined for Node.js v26+ compatibility
// @ts-ignore
util.isNullOrUndefined ??= (x: any): x is null | undefined => x === null || x === undefined;
