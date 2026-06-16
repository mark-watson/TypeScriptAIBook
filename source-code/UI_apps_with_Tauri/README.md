# TypeScript UI Experiments

## The Recommendation: Tauri v2

For building web and macOS apps with TypeScript in 2026, Tauri is the definitive framework for a clean, minimalist approach.
Tauri flips the Electron model. Instead of shipping a browser, it renders your TypeScript web UI using macOS's native webview. The resulting desktop applications are incredibly small (often under 10MB) and launch almost instantly.
Because Tauri compiles down to native binaries, it runs exceptionally efficiently on Apple Silicon. Whether you are running services on a Mac Mini or developing on an M4 Air, it leverages the local hardware without the thermal and memory overhead associated with Chromium-based wrappers.
How it works:

•	Frontend: You build your UI using standard web technologies (TypeScript, HTML, CSS).
•	Backend: Tauri handles OS-level operations through a Rust backend. You write Rust functions (called "commands") and invoke them directly from your TypeScript frontend. It is an excellent architecture for dropping in custom, highly optimized logic—like a custom trial division algorithm—in Rust, while keeping the UI layer strictly focused on presentation.

## The Minimalist Dev Setup

To keep the development environment as simple as possible, avoid massive meta-frameworks. The cleanest modern stack is Tauri + Vite + Svelte + TypeScript.
Vite provides a lightning-fast development server with instant hot-module replacement. Svelte is incredibly lean; unlike React, it doesn't ship a bulky virtual DOM to the browser, compiling your UI down to highly optimized vanilla JavaScript. It perfectly mirrors Tauri's philosophy of doing more with less.
Step-by-Step Initialization:
1. Scaffold the Project
Open your terminal and use the Tauri scaffolding tool. It will prompt you for your preferred stack.
npm create tauri-app@latest

When prompted, select TypeScript / JavaScript, choose your package manager, select Vite, and then choose Svelte (or Vanilla if you want zero UI framework).
2. Project Structure
The resulting directory provides a clean separation of concerns:
•	/src — Your TypeScript UI code lives here.
•	/src-tauri — The Rust backend configuration and native commands live here.
3. Run the Development Server
Navigate into your new directory, install the dependencies, and start the app.
npm install
npm run tauri dev

This command compiles the Rust backend, starts the Vite development server, and opens your native macOS app window. Any changes you make to your TypeScript files will reflect instantly in the app.
