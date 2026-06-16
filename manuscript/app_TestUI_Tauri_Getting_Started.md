# Getting Started with Tauri Desktop Applications

For years, building cross-platform desktop applications meant relying on Electron. While Electron revolutionized desktop development by allowing web developers to use HTML, CSS, and JavaScript, it came with a heavy cost: every app shipped with its own complete copy of the Chromium browser and the Node.js runtime. This resulted in huge executable sizes (often over 100MB for a simple "Hello World"), high memory consumption, and sluggish launch times.

Tauri represents a paradigm shift. Instead of embedding Chromium, Tauri uses the operating system's native webview (WebKit on macOS, WebView2 on Windows, and WebKitGTK on Linux). Instead of Node.js, Tauri uses Rust to handle system-level operations, file access, and native integration. The result is desktop applications that are incredibly lightweight—often under 10MB—launch almost instantly, and use a fraction of the memory that an equivalent Electron app would require.

In this chapter, we explore **testUI-app**, a Tauri v2 starter application built with Vite and vanilla TypeScript. It is the simplest possible demonstration of how Tauri bridges a web-based user interface with a native desktop backend. We will examine the project structure, walk through the HTML and TypeScript frontend, configure Vite and Tauri, write our first Rust command, and run the complete application.

The examples for this chapter are located in the **testUI-app** directory.

---

## Project Structure

A Tauri application is split into two parts: the frontend (web technologies) and the backend (Rust). The frontend code lives in the root directory and the standard `src/` directory, while the backend code lives under the `src-tauri/` directory:

```
testUI-app/
├── index.html              // Web UI entry point
├── package.json            // npm dependencies and dev scripts
├── tsconfig.json           // TypeScript compiler configuration
├── vite.config.ts          // Vite bundler and dev server config
├── src/
│   ├── main.ts             // Frontend application logic (TypeScript)
│   ├── styles.css          // Application styles (CSS)
│   └── assets/             // SVG logos and static assets
└── src-tauri/
    ├── Cargo.toml          // Rust package dependencies
    ├── tauri.conf.json      // Tauri project configuration
    └── src/
        ├── lib.rs           // Rust shared application logic (commands)
        └── main.rs          // Rust binary entry point
```

Let's look at each of these files and see how they contribute to building our desktop application.

---

## The HTML Entry Point

The `index.html` file defines the visual structure of the application. It looks like a standard webpage, but since it runs inside Tauri's webview, it will render as a native desktop window.

Here is the complete source for `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/src/styles.css" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tauri App</title>
    <script type="module" src="/src/main.ts" defer></script>
  </head>
  <body>
    <main class="container">
      <h1>Welcome to Tauri</h1>
      <div class="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/src/assets/vite.svg" class="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/src/assets/tauri.svg" class="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://www.typescriptlang.org/docs" target="_blank">
          <img src="/src/assets/typescript.svg" class="logo typescript" alt="typescript logo" />
        </a>
      </div>
      <p>Click on the Tauri logo to learn more about the framework</p>
      <form class="row" id="greet-form">
        <input id="greet-input" placeholder="Enter a name..." />
        <button type="submit">Greet</button>
      </form>
      <p id="greet-msg"></p>
    </main>
  </body>
</html>
```

### Walkthrough

- **Line 5**: We link to `/src/styles.css` to load our styling.
- **Line 7**: We load `/src/main.ts` using `type="module"` and the `defer` attribute. During development, Vite intercepts this script request and delivers the compiled TypeScript directly to the browser view.
- **Lines 12–24**: A layout of links and logo images showcasing the technologies used: Vite, Tauri, and TypeScript.
- **Lines 26–29**: A simple `<form>` containing a text input field (`#greet-input`) and a submit button. Wrapping input fields in a form element is a best practice because it naturally handles the "Enter" keypress event to submit the value, rather than requiring us to write custom keydown event listeners.
- **Line 30**: An empty paragraph element (`#greet-msg`) that will display the greeting text returned from the Rust backend once the form is submitted.

---

## Frontend Application Logic

The frontend logic is written in TypeScript and lives in `src/main.ts`. Its job is to capture user input, communicate with the Rust backend via Tauri's inter-process communication (IPC) channel, and update the DOM with the result.

Here is the complete source for `src/main.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });
});
```

### Walkthrough

- **Line 1**: We import the `invoke` function from the Tauri API (`@tauri-apps/api/core`). This function is the IPC bridge. Under the hood, it serializes arguments into JSON, transmits them to the Rust backend, and returns a Promise that resolves when the Rust backend sends a response back.
- **Lines 3–4**: We define variables to hold references to our DOM elements. We type them as `HTMLInputElement` and `HTMLElement` or `null` to satisfy the TypeScript compiler's strict safety checks.
- **Lines 6–12**: The `greet()` asynchronous function. If our DOM element references are not null, we call `invoke("greet", { name: greetInputEl.value })`. The first argument is the name of the Rust command we want to call. The second argument is a payload object mapping key-value arguments. The return value is awaited and assigned directly to the text content of `greetMsgEl`.
- **Lines 14–22**: We listen for the `DOMContentLoaded` event to ensure the DOM tree is fully parsed before querying elements. Once loaded, we lookup `#greet-input` and `#greet-msg`, and add a submit listener to our form (`#greet-form`).
- **Line 18**: Inside the form submit handler, we call `e.preventDefault()` to stop the browser from reloading the page when the form is submitted. We then trigger the asynchronous `greet()` function.

---

## Configuring Vite and Tauri

### Vite Configuration

Vite is a modern frontend build tool that is incredibly fast. Tauri uses it during development as a hot-reloading dev server, and during builds to bundle the HTML/TypeScript assets.

Here is `vite.config.ts`:

```typescript
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

#### Walkthrough
- **Line 3**: When running on mobile devices or network interfaces, Tauri sets the `TAURI_DEV_HOST` environment variable to notify Vite of the host address.
- **Line 7**: We set `clearScreen: false` so that compilation output from both Vite and Cargo (Rust's build tool) remains visible in the terminal.
- **Line 9**: We lock the dev server to port `1420` so that Tauri's backend knows exactly where to load the UI during development.
- **Line 10**: We enforce `strictPort: true` so Vite will fail immediately instead of automatically choosing another port if `1420` is already in use.
- **Line 13**: We instruct Vite's file watcher to ignore changes inside `src-tauri/`. Without this, editing Rust backend files would cause Vite to rebuild the frontend, resulting in redundant compiler overhead.

### Tauri Configuration

Tauri is configured via a JSON file at `src-tauri/tauri.conf.json`. This configuration file tells Tauri how to build the application, what size the window should be, and what security settings to apply.

Here is the key configuration chunk:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "testui",
  "version": "0.1.0",
  "identifier": "com.markwatson.testui",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [{ "title": "testui", "width": 800, "height": 600 }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

#### Walkthrough
- **Lines 5–10**: Under `build`, we specify the shell commands Tauri should run. When we launch Tauri in dev mode, it runs `npm run dev` (Vite) and connects the desktop window webview to `http://localhost:1420`. When bundling the final app, it runs `npm run build` and loads the resulting assets from the `../dist` directory.
- **Lines 11–15**: The `app` block configures the window. We create a window titled `"testui"` with dimensions `800x600`.
- **Lines 16–20**: The `bundle` configuration defines icons and packaging parameters. When building, Tauri packages our application into native installers (`.app` on macOS, `.msi` on Windows, and `.deb` on Linux).

---

## The Rust Backend

The backend is written in Rust. It serves as our direct link to the operating system. In the `testUI-app` project, the Rust code is structured as a library (`src-tauri/src/lib.rs`) and an executable binary wrapper (`src-tauri/src/main.rs`). This separation is a Tauri v2 convention that simplifies compilation across desktop and mobile targets.

Let's look at `src-tauri/src/lib.rs` first, where our commands are defined and registered:

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Walkthrough

- **Line 1**: The `#[tauri::command]` attribute is a Rust macro. It generates the necessary serialization boilerplate to expose our Rust function to the TypeScript frontend.
- **Lines 2–4**: The `greet` function. It takes a string slice (`&str`) and returns a new `String`. We use Rust's `format!` macro to construct a friendly greeting. Tauri automatically serializes this returned string into JSON and passes it back across the IPC bridge to our frontend promise.
- **Line 6**: The `#[cfg_attr(mobile, tauri::mobile_entry_point)]` attribute ensures that if we build this project for mobile devices (iOS or Android), Rust knows how to launch the application using the correct entry point.
- **Lines 7–13**: The `run` function initializes and starts our application window:
  - `tauri::Builder::default()` creates a new window builder.
  - `.plugin(tauri_plugin_opener::init())` initializes a system plugin that lets our app open native browser links or files.
  - `.invoke_handler(tauri::generate_handler![greet])` registers our `greet` command so that when `invoke("greet", ...)` is called on the frontend, Tauri knows to route it to this function.
  - `.run(tauri::generate_context!())` compiles configuration variables and starts the window event loop.

Now, let's examine `src-tauri/src/main.rs` which serves as the executable's entry point:

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    testui_lib::run()
}
```

### Walkthrough

- **Line 2**: The `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` attribute tells the compiler that in release mode on Windows, the application should run silently in the background without spawning a command prompt window.
- **Lines 4–6**: The standard Rust main function. All it does is delegate the execution to `testui_lib::run()`, which boots up our window and starts the event loop we defined in `lib.rs`.

---

## Running the Example

To run this desktop application locally, follow these steps:

1. **Install Frontend Dependencies**:
   Open a terminal in the `testUI-app` directory and install the necessary npm packages:
   ```bash
   npm install
   ```

2. **Run the Tauri Development Command**:
   Launch the application in development mode:
   ```bash
   npm run tauri dev
   ```

### What Happens Behind the Scenes?

When you run `npm run tauri dev`:
1. **Frontend dev server starts**: Tauri executes `npm run dev` in the background, starting Vite.
2. **Vite compiles assets**: Vite bundles the CSS and transpiles `main.ts` on-the-fly, serving them at `http://localhost:1420`.
3. **Rust compiles**: Cargo parses `Cargo.toml`, compiles the Rust dependencies, and builds the backend binary.
4. **App launches**: Tauri opens a native desktop window and configures the webview to load `http://localhost:1420`.
5. **IPC setup**: Tauri links the frontend `invoke("greet")` calls to the Rust handler.

### Expected Output

Once compilation finishes, a native desktop window will pop up. Type your name (for example, "Alice") into the text input and click the **Greet** button or press Enter. The paragraph below the form will immediately display:

```
Hello, Alice! You've been greeted from Rust!
```

If you modify `src/main.ts` or `src/styles.css` while the application is running, the frontend webview will reload instantly to reflect your changes, thanks to Vite's Hot Module Replacement (HMR). If you modify Rust files in `src-tauri/`, Tauri will automatically rebuild the Rust binary and relaunch the application window.

---

## Wrap-up

The `testUI-app` starter project shows how lightweight and accessible modern desktop application development has become. By separating the UI logic from the system logic, Tauri gives us the best of both worlds:
- A frontend built using web standards (TypeScript, CSS, and HTML) that is easy to write and style.
- A secure, performance-oriented backend built in Rust for operations that require direct OS access.
- An IPC layer that coordinates communication between these environments using a simple promise-based API.

With this simple scaffolding working, you are ready to construct more complex desktop interfaces, persistence layers, and local AI integrations.
