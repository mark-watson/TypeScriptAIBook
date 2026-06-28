# Part 6: Writing Apps Using Tauri

**Note: Dear Reader, I use macOS for my development. That said Tauri is fully cross-platform. It is not restricted to macOS. It provides native support for Windows, Linux, macOS, and as of Tauri v2, iOS and Android.**

The source code for the Tauri examples in the next four chapters is located in the directory **TypeScriptAIBook/source-code/UI_apps_with_Tauri**.

For building web and macOS apps with TypeScript in 2026, Tauri is the definitive framework for a clean, minimalist approach.
Tauri flips the Electron model. Instead of shipping a browser, it renders your TypeScript web UI using macOS's native webview. The resulting desktop applications are incredibly small (often under 10MB) and launch almost instantly.
Because Tauri compiles down to native binaries, it runs exceptionally efficiently on Apple Silicon. Whether you are running services on a Mac Mini or developing on an M4 Air, it leverages the local hardware without the thermal and memory overhead associated with Chromium-based wrappers.

How it works:

- Frontend: You build your UI using standard web technologies (TypeScript, HTML, CSS).
- Backend: Tauri handles OS-level operations through a Rust backend. You write Rust functions (called "commands") and invoke them directly from your TypeScript frontend. It is an excellent architecture for dropping in custom, highly optimized logic—like a custom trial division algorithm—in Rust, while keeping the UI layer strictly focused on presentation.

**The Minimalist Dev Setup**

To keep the development environment as simple as possible, avoid massive meta-frameworks. In my opinion, dear reader, the cleanest modern stack is Tauri + Vite + Svelte + TypeScript.
Vite provides a lightning-fast development server with instant hot-module replacement. Svelte is incredibly lean; unlike React, it doesn't ship a bulky virtual DOM to the browser, compiling your UI down to highly optimized vanilla JavaScript. It perfectly mirrors Tauri's philosophy of doing more with less.

## Optional Practice Problems

Here are some optional practice problems to help you build, extend, and understand desktop applications using Tauri and TypeScript:

### 1. Refactor the Number Guessing Game to Use a Rust Backend
The current implementation of the Number Guessing Game ([number-guess-app](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/UI_apps_with_Tauri/number-guess-app)) manages the target number and game logic entirely in TypeScript on the frontend. Refactor the application to move this logic to the Rust backend:
- Create a Tauri command in Rust `generate_target_number()` that stores a random number in a Tauri state.
- Create a Tauri command `check_guess(guess: u32) -> String` that compares the user's guess to the secret target and returns `"higher"`, `"lower"`, or `"win"`.
- Update the frontend TypeScript code to invoke these two Rust commands.

### 2. Extend the Test UI App with a New Rust Command
Using the [testUI-app](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/UI_apps_with_Tauri/testUI-app) as a template, add a new mathematical or text processing feature:
- Write a Rust command `process_text(input: &str, operation: &str) -> String` that can perform operations like uppercase, lowercase, or reverse on the input.
- Register this command in the Tauri builder handler.
- Update the frontend UI to include a text input, a dropdown select menu for the operation, and a button to display the processed text.

### 3. Add Custom Ollama Generation Settings to the Chat Client
The [ollama-client-app](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/UI_apps_with_Tauri/ollama-client-app) uses default settings for querying the local model.
- Add UI controls (such as sliders and input fields) to configure settings like `temperature`, `top_p`, and a custom system prompt.
- Update the fetch payload in [main.ts](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/UI_apps_with_Tauri/ollama-client-app/src/main.ts) to forward these parameters under the `options` field to the Ollama `/api/chat` or `/api/generate` endpoint.
- Save the user's preferences locally using `localStorage` so they persist across application restarts.

### 4. Implement SPARQL Query Bookmarking in the Semantic Web App
Extend the [semantic-web-app](file:///Users/markwatson/GITHUB/TypeScriptAIBook/source-code/UI_apps_with_Tauri/semantic-web-app) to include query persistence and management:
- Add a "Save Query" button next to the query form.
- Save queries along with a user-provided title in a list using the browser's `localStorage`.
- Display a side panel or dropdown listing saved queries, and allow the user to select one to populate the query editor.
