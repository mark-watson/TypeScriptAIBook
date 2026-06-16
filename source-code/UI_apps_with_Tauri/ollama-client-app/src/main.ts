// main.ts – Ollama Chat Client
// Modeled after the LocalAssistant pattern from llm_local_models/ollama_memory.ts,
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
const SYSTEM_PROMPT = "You are a helpful, concise assistant. Format your answers with markdown when appropriate.";
const STORAGE_KEY = "ollama-chat-sessions";

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

// ── Helpers ────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Minimal markdown → HTML for assistant messages */
function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/(^|\n)- (.+)/g, "$1<li>$2</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, "");

  // Single newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

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
  const firstUserMsg = session.messages.find((m) => m.role === "user");
  if (firstUserMsg) {
    session.title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "…" : "");
  }
}

// ── Rendering ──────────────────────────────────────

function renderSessionList(): void {
  sessionList.innerHTML = "";

  if (sessions.length === 0) {
    sessionList.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 12px;">No sessions yet</div>`;
    return;
  }

  for (const session of sessions) {
    const item = document.createElement("div");
    item.className = `session-item${session.id === activeSessionId ? " active" : ""}`;
    item.setAttribute("data-id", session.id);

    const msgCount = session.messages.filter((m) => m.role !== "system").length;
    const timeStr = new Date(session.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    item.innerHTML = `
      <div class="session-item-content">
        <div class="session-item-title">${escapeHtml(session.title)}</div>
        <div class="session-item-meta">${msgCount} msg · ${timeStr}</div>
      </div>
      <button class="btn-delete" title="Delete session" data-delete-id="${session.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path>
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
    const deleteBtn = item.querySelector(".btn-delete") as HTMLElement;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const deleteId = deleteBtn.getAttribute("data-delete-id")!;
      deleteSession(deleteId);
    });

    sessionList.appendChild(item);
  }
}

function renderChatMessages(): void {
  const session = getActiveSession();

  if (!session) {
    chatMessages.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
            <line x1="10" y1="22" x2="14" y2="22"/>
          </svg>
        </div>
        <h1 class="welcome-title">Ollama Chat</h1>
        <p class="welcome-subtitle">Start a conversation with your local LLM</p>
      </div>
    `;
    return;
  }

  chatMessages.innerHTML = "";

  for (const msg of session.messages) {
    if (msg.role === "system") continue;
    appendMessageBubble(msg.role as "user" | "assistant", msg.content);
  }

  scrollToBottom();
}

function appendMessageBubble(role: "user" | "assistant", content: string, streaming = false): HTMLElement {
  // Remove welcome screen if present
  const welcome = chatMessages.querySelector(".welcome-screen");
  if (welcome) welcome.remove();

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Y" : "A";

  const bubble = document.createElement("div");
  bubble.className = `message-bubble${streaming ? " streaming-cursor" : ""}`;

  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.innerHTML = escapeHtml(content).replace(/\n/g, "<br>");
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
    setStatus("error", "Ollama not found – is it running?");
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

function setStatus(state: "connected" | "error" | "checking", text: string): void {
  statusDot.className = `status-dot${state === "connected" ? " connected" : state === "error" ? " error" : ""}`;
  statusText.textContent = text;
}

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

  const thinkingBubble = appendMessageBubble("assistant", "", true);
  thinkingBubble.innerHTML = `<div class="thinking-indicator"><span></span><span></span><span></span></div>`;
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
            thinkingBubble.innerHTML = renderMarkdown(fullResponse);
            thinkingBubble.className = "message-bubble streaming-cursor";
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
    fullResponse = `⚠️ Error: ${err instanceof Error ? err.message : "Failed to reach Ollama"}`;
    setStatus("error", "Request failed");
    // Re-check connection
    setTimeout(checkOllama, 2000);
  }

  // Finalize
  thinkingBubble.className = "message-bubble";
  thinkingBubble.innerHTML = renderMarkdown(fullResponse);
  scrollToBottom();

  // Save assistant response
  session.messages.push({ role: "assistant", content: fullResponse });
  saveSessions();
  renderSessionList();

  isStreaming = false;
  updateInputState();
}

// ── Input Handling ─────────────────────────────────

function updateInputState(): void {
  const hasText = chatInput.value.trim().length > 0;
  btnSend.disabled = !hasText || isStreaming;
}

function autoResizeTextarea(): void {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
}

// ── Init ───────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  // Grab DOM references
  chatMessages = document.getElementById("chat-messages")!;
  chatInput = document.getElementById("chat-input") as HTMLTextAreaElement;
  btnSend = document.getElementById("btn-send") as HTMLButtonElement;
  btnNewSession = document.getElementById("btn-new-session") as HTMLButtonElement;
  sessionList = document.getElementById("session-list")!;
  modelSelect = document.getElementById("model-select") as HTMLSelectElement;
  statusDot = document.querySelector(".status-dot")!;
  statusText = document.getElementById("status-text")!;
  welcomeScreen = document.getElementById("welcome-screen");

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
  document.getElementById("chat-form")!.addEventListener("submit", (e) => {
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
