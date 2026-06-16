# Building a Local LLM Chat Client with Ollama

This is the most substantial project in our collection of Tauri examples, and I think it's also the most rewarding. We're going to build a full-featured chat client for Ollama, the popular tool for running large language models locally on your own hardware. We developed an Ollama client library in an earlier chapter that we reuse here (see directory **source-code/llm_local_models**).  The finished application gives you a dark-themed, multi-session chat interface that streams responses token-by-token, renders markdown in assistant messages, auto-detects which models you have installed, and persists your conversation history across restarts.

What I find particularly interesting about this project is the architecture: the Rust backend does almost nothing. All of the intelligence including the streaming HTTP calls to Ollama, the session management, the rendering lives in a single TypeScript file. Tauri is simply providing us with a native window and the freedom to make cross-origin HTTP requests to Ollama's local API. This is a great example of how Tauri v2 lets you build desktop applications that are really just well-packaged web apps with superpowers. This is not a book on Rust programming so I am not using one of the powerful features of Tauri.

## Project Structure

Let's look at how the project is organized:

```
ollama-client-app/
├── index.html              ← Full chat layout with sidebar
├── package.json            ← Dependencies and scripts
├── vite.config.ts          ← Vite dev server config for Tauri
├── src/
│   ├── main.ts             ← All application logic (532 lines)
│   └── styles.css          ← Dark theme design system (596 lines)
└── src-tauri/
    ├── tauri.conf.json      ← Window size, security, bundling
    └── src/lib.rs           ← Minimal Rust that just bootstraps the window
```

The file count is small, but don't let that fool you because there's a lot happening in **main.ts** and **styles.css**. I've intentionally kept everything in vanilla TypeScript with no framework: no React, no Vue, no Svelte. Here we just use the DOM APIs that browsers give us for free. For an application of this complexity, that's a deliberate choice: the entire chat client loads instantly, has zero framework overhead, and is easy to understand top-to-bottom.

## The HTML Shell

The **index.html** file defines the complete layout structure. It's a two-column design: a sidebar on the left for session management and model selection, and a main area on the right for the chat conversation and input bar.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/src/styles.css" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ollama Chat</title>
    <meta name="description"
          content="A local Ollama chat client with conversation
                   memory and session history." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet" />
    <script type="module" src="/src/main.ts" defer></script>
  </head>

  <body>
    <div id="app">
      <!-- Sidebar: Session History -->
      <aside id="sidebar" class="sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Sessions</h2>
          <button id="btn-new-session" class="btn-new-session"
                  title="New Session">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Chat</span>
          </button>
        </div>
        <div id="session-list" class="session-list">
          <!-- Session entries rendered dynamically -->
        </div>
        <div class="sidebar-footer">
          <div class="model-selector">
            <label for="model-select">Model</label>
            <select id="model-select">
              <option value="gemma4:12b-it-qat">gemma4:12b-it-qat</option>
              <option value="nemotron-3-nano:4b">nemotron-3-nano:4b</option>
            </select>
          </div>
        </div>
      </aside>

      <!-- Main Chat Area -->
      <main id="main" class="main">
        <!-- Chat Messages -->
        <div id="chat-messages" class="chat-messages">
          <div id="welcome-screen" class="welcome-screen">
            <div class="welcome-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3
                         5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19
                         13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                <line x1="10" y1="22" x2="14" y2="22"/>
              </svg>
            </div>
            <h1 class="welcome-title">Ollama Chat</h1>
            <p class="welcome-subtitle">Start a conversation with your
                                         local LLM</p>
          </div>
        </div>

        <!-- Input Bar -->
        <div class="input-bar">
          <form id="chat-form" class="chat-form">
            <div class="input-wrapper">
              <textarea
                id="chat-input"
                class="chat-input"
                placeholder="Send a message…"
                rows="1"
                autofocus
              ></textarea>
              <button type="submit" id="btn-send" class="btn-send"
                      title="Send message" disabled>
                <svg width="20" height="20" viewBox="0 0 24 24"
                     fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </form>
          <div class="input-footer">
            <span id="status-indicator" class="status-indicator">
              <span class="status-dot"></span>
              <span id="status-text">Checking Ollama…</span>
            </span>
          </div>
        </div>
      </main>
    </div>
  </body>
</html>
```

A few things worth noticing here. The sidebar has three vertical sections: a header with the "New Chat" button, a scrollable session list that gets populated dynamically by our TypeScript, and a footer with the model selector dropdown. The model `<select>` starts with some hardcoded options, but as you'll see shortly, our code replaces these with whatever models Ollama actually has available.

The main area uses a flexbox column layout. The chat messages area takes up all available space (via `flex: 1`), and the input bar sticks to the bottom. There's a welcome screen shown when no session is active it gets removed dynamically once the user starts chatting.

Notice the status indicator at the very bottom: a small dot and text that shows whether Ollama is reachable. This is a simple UX touch that saves users from wondering why nothing is happening when they haven't started Ollama.

## The Application Logic: main.ts

This is where all the interesting work happens. Let's walk through the file section by section.

### Types and Constants

```typescript
// main.ts – Ollama Chat Client
// Modeled after the LocalAssistant pattern from
// llm_local_models/ollama_memory.ts,
// adapted for browser fetch against Ollama's HTTP API.

// ── Types ──────────────────────────────────────────

type Role = "system" | "user" | "assistant";
interface Msg {
  role: Role;
  content: string;
}

interface Session {
  id: string;
  title: string;
  messages: Msg[];
  model: string;
  createdAt: number;
}

interface OllamaModel {
  name: string;
  model: string;
}

// ── Constants ──────────────────────────────────────

const OLLAMA_BASE = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2:3b";
const SYSTEM_PROMPT =
  "You are a helpful, concise assistant. " +
  "Format your answers with markdown when appropriate.";
const STORAGE_KEY = "ollama-chat-sessions";
```

The type definitions mirror Ollama's own API conventions. The `Msg` interface matches the message format that Ollama's `/api/chat` endpoint expects:  each message has a `role` (system, user, or assistant) and a `content` string. This is the same conversation format used by OpenAI's API, so if you've worked with ChatGPT's API before, this will feel familiar.

The `Session` interface is our own invention. Each session tracks a unique `id`, a display `title` (derived from the first user message), the full `messages` array including the system prompt, which `model` to use, and a `createdAt` timestamp. We store an array of these sessions in localStorage.

`OLLAMA_BASE` points to Ollama's default local server. If you've configured Ollama to run on a different port, you'd change this constant. The `SYSTEM_PROMPT` instructs the model to be concise and use markdown which helps the assistant produce structured responses that our markdown renderer can format nicely.

### Application State and DOM References

```typescript
// ── State ──────────────────────────────────────────

let sessions: Session[] = [];
let activeSessionId: string | null = null;
let isStreaming = false;

// ── DOM References ─────────────────────────────────

let chatMessages: HTMLElement;
let chatInput: HTMLTextAreaElement;
let btnSend: HTMLButtonElement;
let btnNewSession: HTMLButtonElement;
let sessionList: HTMLElement;
let modelSelect: HTMLSelectElement;
let statusDot: HTMLElement;
let statusText: HTMLElement;
let welcomeScreen: HTMLElement | null;
```

The state is deliberately simple: a flat array of sessions, the ID of whichever session is currently active, and a boolean flag to prevent the user from sending messages while a response is still streaming. That `isStreaming` flag is important because without it, a user could fire off multiple requests simultaneously and get interleaved responses.

The DOM references are declared at module scope and assigned during initialization. This is a pattern I like for vanilla TypeScript applications: you grab all your references once at startup, and then every function can use them without re-querying the DOM. It's fast and explicit.

### Helper Functions

```typescript
// ── Helpers ────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) +
         Math.random().toString(36).slice(2, 7);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
```

The `generateId()` function creates short, unique identifiers by combining a base-36 timestamp with a few random characters. It's not cryptographically secure, but it's more than adequate for session IDs in a local application.

The `escapeHtml()` function is a classic browser trick: by setting `textContent` on a DOM element and then reading back `innerHTML`, the browser automatically escapes any HTML special characters (`<`, `>`, `&`, quotes). This protects us from XSS if a user types something that looks like HTML tags.

### The Markdown Renderer

This is one of my favorite parts of the codebase. Instead of pulling in a heavy markdown library, we use a series of regex replacements to handle the most common markdown patterns:

```typescript
/** Minimal markdown → HTML for assistant messages */
function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Code blocks (```...```)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, _lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    }
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(
    /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
    "<em>$1</em>"
  );

  // Unordered lists
  html = html.replace(/(^|\n)- (.+)/g, "$1<li>$2</li>");
  html = html.replace(
    /(<li>.*<\/li>\n?)+/g,
    (m) => `<ul>${m}</ul>`
  );

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, "");

  // Single newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}
```

The key insight here is the order of operations. We process code blocks *first*, before any other transformation, because code blocks should be treated as literal text: we don't want bold or italic processing inside a code fence. After code blocks, we handle inline code, then bold (`**text**`), then italic (`*text*`). The italic regex uses negative lookbehinds and lookaheads (`(?<!\*)` and `(?!\*)`) to avoid matching the `**` sequences that have already been handled as bold.

The list processing is a two-pass approach: first we wrap each `- item` line in `<li>` tags, then we group consecutive `<li>` elements inside a `<ul>`. Finally, double newlines become paragraph breaks and single newlines become `<br>` tags.

Is this a full markdown parser? Absolutely not, it doesn't handle headers, ordered lists, links, images, or nested structures. But for chat responses from an LLM, it covers the patterns that matter most: code blocks, inline code, bold, italic, and bullet lists. That's a good engineering tradeoff for a chat client.

### Session Persistence

```typescript
// ── Persistence ────────────────────────────────────

function saveSessions(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full or unavailable – silently degrade
  }
}

function loadSessions(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      sessions = JSON.parse(raw);
    }
  } catch {
    sessions = [];
  }
}
```

We're using `localStorage` for persistence, which means your chat history survives page reloads and application restarts. The entire sessions array, including all messages, is serialized to JSON and stored under a single key. Both functions wrap their logic in try/catch blocks because `localStorage` can throw in several scenarios: the storage quota is exceeded, the browser is in private mode with storage disabled, or the stored JSON is corrupt.

The trade-off with this approach is that `localStorage` has a 5–10 MB limit depending on the browser. For a local chat client, that's quite a lot of conversations, but if you were building a production application you might want to use IndexedDB or a SQLite database via a Tauri plugin. For our purposes, `localStorage` keeps things simple and requires zero additional dependencies.

### Session Management

```typescript
// ── Session Management ─────────────────────────────

function createSession(): Session {
  const session: Session = {
    id: generateId(),
    title: "New Chat",
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    model: modelSelect?.value || DEFAULT_MODEL,
    createdAt: Date.now(),
  };
  sessions.unshift(session);
  saveSessions();
  return session;
}

function getActiveSession(): Session | undefined {
  return sessions.find((s) => s.id === activeSessionId);
}

function switchToSession(id: string): void {
  activeSessionId = id;
  renderSessionList();
  renderChatMessages();
}

function deleteSession(id: string): void {
  sessions = sessions.filter((s) => s.id !== id);
  saveSessions();

  if (activeSessionId === id) {
    if (sessions.length > 0) {
      switchToSession(sessions[0].id);
    } else {
      activeSessionId = null;
      renderSessionList();
      renderChatMessages();
    }
  } else {
    renderSessionList();
  }
}

function updateSessionTitle(session: Session): void {
  // Use the first user message as the title (truncated)
  const firstUserMsg =
    session.messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    session.title =
      firstUserMsg.content.slice(0, 50) +
      (firstUserMsg.content.length > 50 ? "…" : "");
  }
}
```

Every new session starts with the system prompt already in its message array. This is important: when we later send messages to Ollama, the system prompt is included as the first message in the conversation, which sets the assistant's behavior for the entire session. Note that `sessions.unshift(session)` puts new sessions at the *top* of the list, so the most recent conversation is always first.

The `deleteSession()` function handles an edge case that's easy to overlook: if the user deletes the currently active session, we need to switch to another one (or show the welcome screen if no sessions remain). The `updateSessionTitle()` function auto-generates a title from the first user message, truncated to 50 characters with an ellipsis. This gives the session list meaningful labels without requiring the user to manually name their conversations.

### Rendering the UI

The rendering functions are where our vanilla TypeScript approach shows its character. Without a framework's virtual DOM or reactive bindings, we're building DOM elements imperatively:

```typescript
// ── Rendering ──────────────────────────────────────

function renderSessionList(): void {
  sessionList.innerHTML = "";

  if (sessions.length === 0) {
    sessionList.innerHTML = `<div style="padding: 20px;
      text-align: center; color: var(--text-tertiary);
      font-size: 12px;">No sessions yet</div>`;
    return;
  }

  for (const session of sessions) {
    const item = document.createElement("div");
    item.className = `session-item${
      session.id === activeSessionId ? " active" : ""
    }`;
    item.setAttribute("data-id", session.id);

    const msgCount =
      session.messages.filter((m) => m.role !== "system").length;
    const timeStr = new Date(session.createdAt)
      .toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    item.innerHTML = `
      <div class="session-item-content">
        <div class="session-item-title">
          ${escapeHtml(session.title)}
        </div>
        <div class="session-item-meta">
          ${msgCount} msg · ${timeStr}
        </div>
      </div>
      <button class="btn-delete" title="Delete session"
              data-delete-id="${session.id}">
        <svg width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0
                   01-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
        </svg>
      </button>
    `;

    // Click to switch session
    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".btn-delete")) return;
      switchToSession(session.id);
    });

    // Delete button
    const deleteBtn =
      item.querySelector(".btn-delete") as HTMLElement;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const deleteId =
        deleteBtn.getAttribute("data-delete-id")!;
      deleteSession(deleteId);
    });

    sessionList.appendChild(item);
  }
}
```

Each session item in the sidebar shows the title, a message count (excluding the system prompt), and a formatted timestamp. The delete button is initially invisible (via CSS `opacity: 0`) and only appears on hover which is a common UX pattern that keeps the interface clean while still providing the functionality.

Notice how the click handler on the session item checks `target.closest(".btn-delete")` before switching sessions. This prevents a click on the delete button from *also* triggering a session switch. The delete button gets its own click handler with `e.stopPropagation()` to prevent the event from bubbling up to the parent.

```typescript
function renderChatMessages(): void {
  const session = getActiveSession();

  if (!session) {
    chatMessages.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24"
               fill="none" stroke="currentColor"
               stroke-width="1.5" stroke-linecap="round"
               stroke-linejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3
                     5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26
                     C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
            <line x1="10" y1="22" x2="14" y2="22"/>
          </svg>
        </div>
        <h1 class="welcome-title">Ollama Chat</h1>
        <p class="welcome-subtitle">Start a conversation with
                                     your local LLM</p>
      </div>
    `;
    return;
  }

  chatMessages.innerHTML = "";

  for (const msg of session.messages) {
    if (msg.role === "system") continue;
    appendMessageBubble(
      msg.role as "user" | "assistant",
      msg.content
    );
  }

  scrollToBottom();
}

function appendMessageBubble(
  role: "user" | "assistant",
  content: string,
  streaming = false
): HTMLElement {
  // Remove welcome screen if present
  const welcome =
    chatMessages.querySelector(".welcome-screen");
  if (welcome) welcome.remove();

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Y" : "A";

  const bubble = document.createElement("div");
  bubble.className = `message-bubble${
    streaming ? " streaming-cursor" : ""
  }`;

  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.innerHTML =
      escapeHtml(content).replace(/\n/g, "<br>");
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);

  return bubble;
}

function scrollToBottom(): void {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}
```

The `renderChatMessages()` function does a full re-render of the chat area. When there's no active session, it shows the welcome screen. Otherwise, it iterates through all messages, skipping the system prompt (which is for the LLM's eyes only, not the user's). Each message gets passed to `appendMessageBubble()`, which constructs a message element with an avatar and a content bubble.

User messages get simple HTML escaping with newline-to-`<br>` conversion, while assistant messages go through our `renderMarkdown()` function. The `streaming` parameter controls whether a blinking cursor CSS class is applied and this gives the user a visual cue that more text is coming.

The `scrollToBottom()` function uses `requestAnimationFrame` to ensure the scroll happens after the DOM has been updated. This is a subtle but important detail because without `requestAnimationFrame`, the scroll might happen before the browser has laid out the new content, and the chat wouldn't scroll all the way down.

### Ollama API Integration

Now we get to the heart of the application: the code that talks to Ollama.

```typescript
// ── Ollama API ─────────────────────────────────────

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (res.ok) {
      const data = await res.json();
      populateModels(data.models || []);
      setStatus("connected", "Ollama connected");
      return true;
    }
    setStatus("error", "Ollama not responding");
    return false;
  } catch {
    setStatus("error",
              "Ollama not found – is it running?");
    return false;
  }
}

function populateModels(models: OllamaModel[]): void {
  const currentValue = modelSelect.value;
  modelSelect.innerHTML = "";

  if (models.length === 0) {
    const opt = document.createElement("option");
    opt.value = DEFAULT_MODEL;
    opt.textContent = DEFAULT_MODEL;
    modelSelect.appendChild(opt);
    return;
  }

  for (const m of models) {
    const opt = document.createElement("option");
    opt.value = m.name;
    opt.textContent = m.name;
    modelSelect.appendChild(opt);
  }

  // Restore selection if still available
  if (models.some((m) => m.name === currentValue)) {
    modelSelect.value = currentValue;
  }
}

function setStatus(
  state: "connected" | "error" | "checking",
  text: string
): void {
  statusDot.className = `status-dot${
    state === "connected"
      ? " connected"
      : state === "error"
        ? " error"
        : ""
  }`;
  statusText.textContent = text;
}
```

The `checkOllama()` function serves two purposes: it verifies that Ollama is running and reachable, and it discovers which models are available. Ollama's `/api/tags` endpoint returns a JSON object with a `models` array, each entry containing a `name` field (like `"llama3.2:3b"` or `"gemma4:12b-it-qat"`). We use this to dynamically populate the model dropdown.

The `populateModels()` function is careful to preserve the user's current selection if that model is still available. This matters because we call `checkOllama()` at startup so for example if the user had previously selected a specific model and it's still installed, the dropdown should show it.

The status indicator uses three states: `connected` (green dot), `error` (red dot), and `checking` (amber dot, the default). The CSS handles the visual styling with colored backgrounds and subtle glowing box-shadows.

### Streaming Responses: The Core of the Chat Client

This is the most technically interesting part of the entire application. When the user sends a message, we need to stream the response from Ollama token by token, updating the UI in real-time as each token arrives:

```typescript
async function sendMessage(userText: string): Promise<void> {
  if (isStreaming || !userText.trim()) return;

  // Ensure we have a session
  let session = getActiveSession();
  if (!session) {
    session = createSession();
    activeSessionId = session.id;
    renderSessionList();
  }

  // Add user message
  session.messages.push({ role: "user", content: userText });
  updateSessionTitle(session);
  saveSessions();
  renderSessionList();

  // Render user bubble
  appendMessageBubble("user", userText);
  scrollToBottom();

  // Show thinking indicator
  isStreaming = true;
  updateInputState();

  const thinkingBubble =
    appendMessageBubble("assistant", "", true);
  thinkingBubble.innerHTML =
    `<div class="thinking-indicator">` +
    `<span></span><span></span><span></span></div>`;
  scrollToBottom();

  // Stream response from Ollama
  let fullResponse = "";
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: session.model,
        messages: session.messages,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Ollama error: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message?.content) {
            fullResponse += chunk.message.content;
            thinkingBubble.innerHTML =
              renderMarkdown(fullResponse);
            thinkingBubble.className =
              "message-bubble streaming-cursor";
            scrollToBottom();
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.message?.content) {
          fullResponse += chunk.message.content;
        }
      } catch {
        // Skip
      }
    }
  } catch (err) {
    fullResponse =
      `⚠️ Error: ${
        err instanceof Error
          ? err.message
          : "Failed to reach Ollama"
      }`;
    setStatus("error", "Request failed");
    // Re-check connection
    setTimeout(checkOllama, 2000);
  }

  // Finalize
  thinkingBubble.className = "message-bubble";
  thinkingBubble.innerHTML = renderMarkdown(fullResponse);
  scrollToBottom();

  // Save assistant response
  session.messages.push({
    role: "assistant",
    content: fullResponse,
  });
  saveSessions();
  renderSessionList();

  isStreaming = false;
  updateInputState();
}
```

Let me walk through the streaming architecture in detail, because it's the most important pattern in this chapter.

**The Ollama Chat API.** We POST to `/api/chat` with three key fields: the `model` name, the full `messages` array (including the system prompt and all previous conversation turns), and `stream: true`. That last field is crucial because it tells Ollama to send the response as a series of newline delimited JSON (NDJSON) chunks rather than waiting for the complete response.

**ReadableStream + TextDecoder.** When `stream: true` is set, `fetch()` returns a response whose body is a `ReadableStream`. We obtain a reader via `res.body.getReader()` and create a `TextDecoder` to convert the raw byte chunks into strings. The `{ stream: true }` option on `decoder.decode()` tells the decoder not to flush which is important because a multi-byte UTF-8 character might be split across two chunks.

**NDJSON parsing.** Each chunk from Ollama is a JSON object on its own line, like:

```json
{"model":"llama3.2:3b","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3.2:3b","message":{"role":"assistant","content":" there"},"done":false}
{"model":"llama3.2:3b","message":{"role":"assistant","content":"!"},"done":true}
```

The tricky part is that a network chunk doesn't necessarily align with JSON line boundaries. A single `reader.read()` call might return half a JSON line, or two-and-a-half lines. That's why we maintain a `buffer`. After each read, we split the buffer on newlines: all lines except the last one are guaranteed to be complete (because they have a newline after them), so we can parse those immediately. The last element — which might be an incomplete line — becomes the new buffer for the next iteration.

**Real-time UI updates.** For each successfully parsed chunk, we append the new content to `fullResponse` and re-render the entire assistant bubble with `renderMarkdown(fullResponse)`. Yes, we're re-rendering the markdown on every token. This might seem wasteful, but markdown rendering needs the full text to produce correct output (a code fence that started three tokens ago needs to be detected as a whole), and the regex-based renderer is fast enough that you won't notice any lag.

**Error handling.** If the fetch fails or Ollama returns an error, we display the error message in the assistant bubble and schedule a reconnection check after 2 seconds. The `isStreaming` flag is always reset in the finalization block, regardless of whether the request succeeded or failed.

**The thinking indicator.** Before the first token arrives, we show an animated three-dot indicator (styled with CSS animations). The moment the first content token comes through, the thinking indicator is replaced with the actual response text plus a blinking cursor. When streaming completes, the cursor class is removed.

### Input Handling

```typescript
// ── Input Handling ─────────────────────────────────

function updateInputState(): void {
  const hasText = chatInput.value.trim().length > 0;
  btnSend.disabled = !hasText || isStreaming;
}

function autoResizeTextarea(): void {
  chatInput.style.height = "auto";
  chatInput.style.height =
    Math.min(chatInput.scrollHeight, 160) + "px";
}
```

The `updateInputState()` function keeps the send button disabled when there's no text or when a response is currently streaming. This provides visual feedback and prevents accidental duplicate submissions.

The `autoResizeTextarea()` function implements a common pattern for auto-growing textareas: first set the height to `"auto"` to let the browser calculate the natural height, then set it to `scrollHeight` (capped at 160 pixels) to match the actual content height. This lets the textarea grow as the user types multiple lines, up to a maximum height, after which it becomes scrollable.

### Initialization and Event Wiring

```typescript
// ── Init ───────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  // Grab DOM references
  chatMessages =
    document.getElementById("chat-messages")!;
  chatInput =
    document.getElementById("chat-input") as
    HTMLTextAreaElement;
  btnSend =
    document.getElementById("btn-send") as
    HTMLButtonElement;
  btnNewSession =
    document.getElementById("btn-new-session") as
    HTMLButtonElement;
  sessionList =
    document.getElementById("session-list")!;
  modelSelect =
    document.getElementById("model-select") as
    HTMLSelectElement;
  statusDot =
    document.querySelector(".status-dot")!;
  statusText =
    document.getElementById("status-text")!;
  welcomeScreen =
    document.getElementById("welcome-screen");

  // Load persisted sessions
  loadSessions();
  if (sessions.length > 0) {
    activeSessionId = sessions[0].id;
  }
  renderSessionList();
  renderChatMessages();

  // Check Ollama connectivity
  checkOllama();

  // ── Event Listeners ────────────────────────────

  // New Session
  btnNewSession.addEventListener("click", () => {
    const session = createSession();
    switchToSession(session.id);
    chatInput.focus();
  });

  // Send message
  document.getElementById("chat-form")!
    .addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text) {
        chatInput.value = "";
        chatInput.style.height = "auto";
        updateInputState();
        sendMessage(text);
      }
    });

  // Textarea auto-resize & enter-to-send
  chatInput.addEventListener("input", () => {
    updateInputState();
    autoResizeTextarea();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!btnSend.disabled) {
        const text = chatInput.value.trim();
        if (text) {
          chatInput.value = "";
          chatInput.style.height = "auto";
          updateInputState();
          sendMessage(text);
        }
      }
    }
  });

  // Model selector – update active session model
  modelSelect.addEventListener("change", () => {
    const session = getActiveSession();
    if (session) {
      session.model = modelSelect.value;
      saveSessions();
    }
  });
});
```

The initialization function does everything in the right order: grab DOM references, load persisted sessions, render the initial UI, and check Ollama connectivity. The event listeners implement a few UX conventions that users expect from a chat application:

- **Enter to send:** Pressing Enter submits the message. Shift+Enter inserts a newline (for multi-line messages). This matches the behavior of every modern chat app.
- **Form submission:** The chat form also handles the submit event, which is triggered both by the Enter key handler and by clicking the send button.
- **Model switching:** When the user selects a different model from the dropdown, the active session's model is updated immediately and persisted. This means you can switch models mid-conversation if you want.

## The Rust Backend

As I mentioned earlier, the Rust backend is deliberately minimal:

```rust
// Ollama Chat – Tauri backend
// All Ollama communication happens via the frontend fetch API.
// The Rust backend just bootstraps the Tauri window.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

There are no custom Rust commands here. All communication with Ollama happens via the browser's `fetch()` API from the TypeScript frontend. This works because Tauri's webview allows cross-origin requests to `localhost` — something a normal browser would block with CORS restrictions. The `tauri.conf.json` has `"csp": null` in the security section, which disables Content Security Policy restrictions entirely. In a production application you'd want to tighten this, but for a local dev tool that only talks to localhost, it's perfectly reasonable.

The `tauri.conf.json` also sets the window dimensions and minimum size:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Ollama Chat",
  "version": "0.1.0",
  "identifier": "com.markwatson.ollama-client-app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Ollama Chat",
        "width": 1100,
        "height": 750,
        "minWidth": 700,
        "minHeight": 500
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

The `1100×750` default size gives comfortable room for the sidebar and chat area side by side, while the `700×500` minimum prevents the layout from collapsing into an unusable state.

## The Dark Theme Design System

The CSS file is nearly 600 lines, but the most important part is the design token system at the top. Here's a representative excerpt:

```css
:root {
  /* Colors – dark theme inspired by modern chat UIs */
  --bg-primary: #0d0f13;
  --bg-secondary: #151820;
  --bg-sidebar: #111318;
  --bg-surface: #1a1d26;
  --bg-hover: #1f2330;
  --bg-active: #252a38;
  --bg-input: #1a1d26;
  --bg-user-msg: #2563eb;
  --bg-assistant-msg: #1e2230;

  --text-primary: #e8eaf0;
  --text-secondary: #8b8fa6;
  --text-tertiary: #5c6078;

  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --accent-glow: rgba(59, 130, 246, 0.15);
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);

  --sidebar-width: 280px;
  --input-max-width: 768px;
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont,
                 'Segoe UI', system-ui, sans-serif;
}
```

By defining all colors, spacing, and animation curves as CSS custom properties, the entire theme can be modified from a single location. The color palette uses very dark, slightly blue-tinted backgrounds (notice how `--bg-primary` is `#0d0f13`, not pure black) with blue accents. This gives the UI a modern, professional look that's easy on the eyes during extended use.

A few CSS techniques worth highlighting:

**The streaming cursor** uses a pseudo-element with a blinking animation:

```css
.streaming-cursor::after {
  content: '▎';
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: var(--accent);
}
```

**The thinking indicator** uses three dots with staggered animations:

```css
.thinking-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: thinking 1.4s infinite ease-in-out both;
}
.thinking-indicator span:nth-child(2) {
  animation-delay: 0.16s;
}
.thinking-indicator span:nth-child(3) {
  animation-delay: 0.32s;
}
```

**Message bubbles** have different border-radius corners depending on the role — user messages have a small bottom-right radius (creating a "speech bubble" effect pointing right), while assistant messages have a small bottom-left radius (pointing left):

```css
.message.user .message-bubble {
  background: var(--bg-user-msg);
  border-bottom-right-radius: var(--radius-sm);
}
.message.assistant .message-bubble {
  background: var(--bg-assistant-msg);
  border-bottom-left-radius: var(--radius-sm);
}
```

## Running the Example

To run this project, you need two things: Ollama running locally, and the Tauri development toolchain.

**Prerequisites:**

1. **Install Ollama** from [ollama.com](https://ollama.com) and start it. Verify it's running:

```bash
ollama list
```

You should see at least one model. If you don't have any models yet, pull one:

```bash
ollama pull llama3.2:3b
```

2. **Install dependencies** in the project directory:

```bash
cd ollama-client-app
npm install
```

3. **Start the Tauri development server:**

```bash
npm run tauri dev
```

This starts both Vite (the frontend dev server on port 1420) and the Tauri native window. You'll see Rust compilation output the first time, which takes a minute or two. After that, hot module reload will give you instant feedback as you edit the TypeScript or CSS.

When the application launches, check the status indicator at the bottom of the window. If it shows a green dot with "Ollama connected," you're ready to chat. If it shows a red dot, make sure Ollama is running (`ollama serve` in a terminal, or the Ollama desktop app).

The model dropdown in the sidebar footer will automatically populate with all the models you have installed locally. Select one, type a message in the text area, and press Enter. You'll see the three-dot thinking animation briefly, followed by the response streaming in token by token.

Try creating multiple sessions, switching between them, and deleting old ones. Your conversation history persists in the webview's `localStorage`, so it survives application restarts.

## Wrap Up

This chapter covered a lot of ground. We built a full-featured chat client that demonstrates several important patterns:

- **Streaming HTTP with ReadableStream:** The NDJSON parsing approach — maintaining a buffer, splitting on newlines, processing complete lines while keeping partial lines for the next iteration — is a pattern you'll use whenever you work with streaming APIs. It applies equally to OpenAI's streaming endpoint, Server-Sent Events, and any other newline-delimited protocol.

- **Vanilla TypeScript without frameworks:** For applications of moderate complexity, you don't always need React or Vue. The imperative DOM manipulation approach keeps the bundle tiny, the startup instant, and the code easy to debug. The trade-off is that you need to manually manage state synchronization (calling `renderSessionList()` and `saveSessions()` in the right places), which a framework would handle declaratively.

- **Tauri as a thin wrapper:** The Rust backend did almost nothing, and that's the point. Tauri gave us a native window, cross-origin fetch capability, and the ability to bundle the app as a standalone desktop application — all without writing any Rust logic. For applications that primarily consume HTTP APIs, this "thin Tauri" pattern is very effective.

- **Progressive UX:** Small touches like the connection status indicator, the animated thinking dots, the streaming cursor, and the auto-growing textarea collectively create an experience that feels polished and responsive. These aren't hard to implement individually, but together they make the difference between a prototype and something you actually want to use.

The Ollama chat client is a practical tool — I use it regularly — and I hope walking through its implementation gives you confidence to build your own local AI applications. The patterns here generalize well beyond Ollama: any streaming API, any chat-style interface, any session management system will use similar techniques.
