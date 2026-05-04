# Setting Up a TypeScript Development Environment

All of the examples in this book are command-line TypeScript programs that run on Node.js. This chapter walks you through setting up everything you need to write, compile, and run the examples.

Here are a few things to consider when setting up your TypeScript development environment:

- Use **Node.js** (version 20 or later) as the runtime for all examples.
- Use **npm** or **pnpm** for managing packages. I use npm in this book since it comes bundled with Node.js.
- Use **tsx** to run TypeScript files directly without a separate compile step. This is the fastest way to iterate on command-line scripts.
- Use Git or another version control system to manage your codebase. I will not cover Git here so [read a good tutorial](https://git-scm.com/docs/gittutorial) if you have not used it before.
- Use an IDE like VS Code (which has excellent built-in TypeScript support), WebStorm, or a text editor like Emacs or Vim — whatever you are comfortable with.
- Add comments and documentation to your code. Your "future you" will thank you.

## Installing Node.js

Node.js is the JavaScript runtime that powers our TypeScript programs. Install it from [nodejs.org](https://nodejs.org/) or use a version manager.

On macOS using Homebrew:

```bash
brew install node
```

On macOS or Linux using nvm (Node Version Manager):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 22
nvm use 22
```

Verify your installation:

```bash
$ node --version
v22.14.0

$ npm --version
10.9.2
```

## Installing TypeScript and tsx

TypeScript is the language compiler and **tsx** is a tool that lets you run `.ts` files directly without a separate compilation step. Install them globally:

```bash
npm install -g typescript tsx
```

Verify the installation:

```bash
$ tsc --version
Version 5.7.3

$ tsx --version
tsx v4.19.0
```

You can now run any TypeScript file directly:

```bash
tsx my_script.ts
```

## Setting Up a Project

Every source code directory in this book follows the same pattern: initialize a project with `npm init`, install the required packages, and run scripts with `tsx`. Here is a typical setup:

```bash
# Initialize a new project (creates package.json)
$ npm init -y

# Install TypeScript as a dev dependency
$ npm install -D typescript @types/node

# Create a tsconfig.json with sensible defaults
$ npx tsc --init --target ES2022 --module NodeNext \
    --moduleResolution NodeNext --outDir ./dist \
    --strict --esModuleInterop

# Install libraries the project needs
$ npm install mathjs

# Run a script directly with tsx
$ tsx my_script.ts
```

### The tsconfig.json File

The `tsconfig.json` file configures the TypeScript compiler. Here is the configuration I use throughout this book:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Key settings:

- **target: "ES2022"** — use modern JavaScript features like top-level await and private class fields.
- **module: "NodeNext"** — use Node.js's native ES module resolution.
- **strict: true** — enable all strict type checking options. This catches more bugs at compile time.
- **esModuleInterop: true** — allows importing CommonJS modules with default imports.

### The package.json File

Each project's `package.json` should include `"type": "module"` so Node.js treats `.js` files as ES modules:

```json
{
  "name": "my-ai-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx main.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

## Running TypeScript Files

There are three ways to run TypeScript files:

### Using tsx (Recommended for Development)

The fastest way to run TypeScript during development. No compilation step needed:

```bash
tsx my_script.ts
```

### Compiling and Running with Node

For production or when you want to inspect the compiled output:

```bash
npx tsc
node dist/my_script.js
```

### Using npx tsx (Without Global Install)

If you prefer not to install tsx globally:

```bash
npx tsx my_script.ts
```

## Environment Variables

Several examples in this book require API keys stored as environment variables. Add these to your shell profile (e.g., `~/.zshrc` or `~/.bashrc`):

```bash
export GOOGLE_API_KEY="your-google-api-key"
export OPENAI_API_KEY="your-openai-api-key"
```

In TypeScript, access them with:

```typescript
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("Please set the GOOGLE_API_KEY environment variable");
  process.exit(1);
}
```

## Code Formatting (Optional)

I recommend [Prettier](https://prettier.io/) for automatic code formatting:

```bash
npm install -D prettier
npx prettier --write "*.ts"
```

You can also use [ESLint](https://eslint.org/) with the TypeScript plugin for linting:

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

