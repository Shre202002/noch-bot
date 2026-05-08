(function () {
  const scriptTag = document.currentScript;
  const userId = scriptTag?.getAttribute("data-user-id");
  if (!userId) return;

  const BASE_URL =
    scriptTag?.getAttribute("data-api") ||
    (scriptTag?.src ? new URL(scriptTag.src).origin : "http://localhost:3000");

  const STORAGE_KEY = "cb_messages_" + userId;
  const OPEN_KEY = "cb_open_" + userId;
  const THEME_KEY = "cb_theme_" + userId;

  const style = document.createElement("style");
  style.textContent = `
 :root {
  --cb-primary: #6366f1;
  --cb-header-bg: #6366f1;
  --cb-user-msg: #6366f1;
  --cb-bot-msg: #ffffff;
  --cb-bg: #f7f8fc;
  --cb-text: #111827;
  --cb-border: #ececf3;
  --cb-accent: #6366f1;
  --cb-send-btn: #6366f1;
}
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
    #cb-bubble {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--cb-primary);
      box-shadow: 0 4px 20px rgba(99,102,241,0.4);
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; z-index: 2147483647;
      transition: transform 0.2s, box-shadow 0.2s;
      border: none; outline: none;
    }
    #cb-bubble:hover { transform: scale(1.08); }
    #cb-bubble svg { width: 22px; height: 22px; }
    #cb-bubble .cb-badge {
      position: absolute; top: -2px; right: -2px;
      width: 13px; height: 13px; background: #22c55e;
      border-radius: 50%; border: 2px solid white;
    }
    #cb-window {
      position: fixed; bottom: 92px; right: 24px;
      width: 390px;
      height: 640px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06);
      z-index: 2147483646; border: none;
      transition:
  opacity 0.28s cubic-bezier(.16,1,.3,1),
  transform 0.28s cubic-bezier(.16,1,.3,1);
      transform-origin: bottom right;
      display: flex; flex-direction: column;
      background: var(--cb-bg); font-family: 'DM Sans', sans-serif;
    }
    #cb-window.cb-hidden {
      opacity: 0; transform: scale(0.9) translateY(8px);
      pointer-events: none; visibility: hidden;
    }
    #cb-header {
      background: var(--cb-header-bg);
      border-bottom: 1px solid #eeeef2; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #cb-avatar {
      width: 36px; height: 36px; border-radius: 11px;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #cb-avatar svg { width: 16px; height: 16px; }
    #cb-header-info { flex: 1; }
    #cb-header-name { font-size: 13px; font-weight: 500; color: var(--cb-bot-msg); }
    #cb-status { display: flex; align-items: center; gap: 4px; font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 1px; }
    #cb-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
    #cb-status-dot.typing { background: #f59e0b; animation: cb-pulse 1s infinite; }
    #cb-close-btn {
      background: rgba(255,255,255,0.15); border: none; cursor: pointer;
      padding: 6px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #cb-close-btn:hover { background: rgba(255,255,255,0.25); }
    #cb-close-btn svg { width: 16px; height: 16px; }
    #cb-messages {
      flex: 1; overflow-y: auto; padding: 20px 16px;
      display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth;
    }
      #cb-messages::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.12);
  border-radius: 999px;
}
    #cb-messages::-webkit-scrollbar { width: 5px; }
    #cb-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
    .cb-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; flex: 1; text-align: center; gap: 12px; padding: 20px;
    }
    .cb-empty-icon {
      width: 50px; height: 50px; border-radius: 16px; background:var(--cb-primary);
      display: flex; align-items: center; justify-content: center;
    }
    .cb-empty-icon svg { width: 22px; height: 22px; }
    .cb-empty-title { font-size: 14px; font-weight: 500; color: #111; }
    .cb-empty-sub { font-size: 12px; color: #999; line-height: 1.5; max-width: 200px; }
    .cb-suggestions { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    .cb-suggestion {
      background: var(--cb-bot-msg); border: 1px solid #eeeef2; color: #444;
      box-shadow: 0 2px 10px rgba(0,0,0,0.04);
      font-size: 12px; padding: 9px 12px; border-radius: 10px;
      cursor: pointer; text-align: left; transition: all 0.15s;
      font-family: 'DM Sans', sans-serif; width: 100%;
    }
    .cb-suggestion:hover { background: #f0f0ff; border-color: #c7d2fe; color: #4f46e5; }
    .cb-msg-row { width: 100%;display: flex; gap: 7px; align-items: flex-end; animation: cb-fadein 0.2s ease; }
    .cb-msg-row.user { justify-content: flex-end; }
    .cb-msg-av {
      width: 26px; height: 26px; border-radius: 8px; background: var(--cb-primary);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-bottom: 2px;
    }
    .cb-msg-av svg { width: 12px; height: 12px; }
    .cb-bubble-msg {
      max-width: 78%;min-width: 44px;padding: 9px 13px; border-radius: 16px;
      font-size: 14px;line-height: 1.75;letter-spacing: -0.01em;word-break: break-word;
      font-family: 'DM Sans', sans-serif;
    }
    .cb-bubble-msg.assistant {
      background: var(--cb-bot-msg); color: #222; border: 1px solid #eeeef2;
      border-bottom-left-radius: 3px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .cb-bubble-msg.assistant strong { font-weight: 600; color: #111; }
    .cb-bubble-msg.assistant ul { margin: 6px 0 6px 16px; padding: 0; }
    .cb-bubble-msg.assistant li { margin-bottom: 3px; }
    .cb-bubble-msg.user {
      background: var(--cb-user-msg); color: var(--cb-bot-msg); border-bottom-right-radius: 3px;
      box-shadow: 0 2px 8px rgba(99,102,241,0.25);
    }
    .cb-typing {
      background: var(--cb-bot-msg); border: 1px solid #eeeef2; border-bottom-left-radius: 3px;
      padding: 11px 14px; border-radius: 16px; display: flex; gap: 3px; align-items: center;
    }
    .cb-typing-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: #bbb; animation: cb-bounce 1.2s infinite ease;
    }
    .cb-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .cb-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    .cb-error {
      background: #fff5f5; border: 1px solid #fecaca; color: #dc2626;
      font-size: 11px; padding: 8px 12px; border-radius: 10px; text-align: center;
    }
    #cb-input-area { background: var(--cb-bot-msg); border-top: 1px solid #eeeef2; padding: 11px 12px; flex-shrink: 0; }
    #cb-input-row {
      display: flex; gap: 7px; align-items: center;min-height: 48px;
      background: #ffffff; border: 1.5px solid #e4e7ee;
box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
      border-radius: 14px; padding: 7px 7px 7px 12px; transition: border-color 0.15s;
    }
    #cb-input-row:focus-within { border-color: #a5b4fc; background: #fff; }
    #cb-input {
    min-height: 20px;max-height: 120px;overflow-y: auto;resize: none;
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 13px; color: #222; font-family: 'DM Sans', sans-serif; line-height: 1.4;
    }
    #cb-input::placeholder { color: #bbb; }
#cb-send svg {
  width: 16px;
  height: 16px;
  fill: white;
}
    #cb-send {
      width: 36px; height: 36px; border-radius: 9px;background: var(--cb-send-btn);
      border: none; cursor: pointer; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; transition: all 0.15s;
      box-shadow: 0 2px 6px rgba(99,102,241,0.3);
    }

    #cb-send:hover:not(:disabled) { transform: scale(1.05); }
    #cb-send:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
    #cb-send svg { width: 13px; height: 13px; fill: white; }
    #cb-footer {   text-align: center;
  margin-top: 8px;
  font-size: 10px;
  color: #bbb;
  flex-shrink: 0;}
    #cb-footer a { color: #a5b4fc; text-decoration: none; }
    @keyframes cb-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes cb-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
    @keyframes cb-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @media (max-width: 480px) {
      #cb-window { width:100vw; height:100dvh; bottom:0; right:0; border-radius:0; }
      #cb-bubble { bottom:16px; right:16px; }
    }
  `;
  document.head.appendChild(style);

  const sparkSVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="white"/></svg>`;
  const closeSVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`;
  const sendSVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/></svg>`;

  const SUGGESTIONS = [
    "What can you help me with?",
    "Tell me about this website",
    "How do I get started?",
    "What products or services do you offer?"
  ];

  let messages = [];
  let loading = false;
  let currentTheme = null;

  function saveMessages() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (e) { }
  }
  function loadMessages() {
    try { const s = sessionStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  }
  function saveOpenState(open) {
    try { sessionStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch (err) {
      console.error("Stream parse error:", err);
    }
  }
  function loadOpenState() {
    try { return sessionStorage.getItem(OPEN_KEY) === "1"; } catch { return false; }
  }

  // ── FIX 1: Markdown → HTML converter ─────────────────────
  function parseMarkdown(text) {
    return text
      // Bold: **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.*?)__/g, "<strong>$1</strong>")
      // Italic: *text* or _text_
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/_(.*?)_/g, "<em>$1</em>")
      // Bullet points: lines starting with * or -
      .replace(/^[\*\-] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      // Line breaks
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>")
      // Wrap in paragraph if not already wrapped
      .replace(/^(?!<[uo]l|<p)(.+)/, "<p>$1</p>");
  }

  // ── FIX 2: Clean theme fetch ──────────────────────────────
  async function loadTheme() {
    try {
      const res = await fetch(
        BASE_URL + "/api/theme?userId=" + userId + "&t=" + Date.now()
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.theme) {
        currentTheme = data.theme;
        return data.theme;
      }
    } catch { }
    return null;
  }

  function applyTheme(theme) {
    if (!theme) return;
    currentTheme = theme;
  
    // Remove old injected styles
    const old = document.getElementById("cb-theme-vars");
    if (old) old.remove();
  
    // Also update CSS variables on :root for elements using var()
    const root = document.documentElement;
    root.style.setProperty("--cb-primary",    theme.bubbleColor  || "#6366f1");
    root.style.setProperty("--cb-header-bg",  theme.headerColor  || "#6366f1");
    root.style.setProperty("--cb-user-msg",   theme.userMsgColor || "#6366f1");
    root.style.setProperty("--cb-send-btn",   theme.sendBtnColor || "#6366f1");
    root.style.setProperty("--cb-accent",     theme.accentColor  || "#6366f1");
  
    // Also inject !important styles for elements that need direct override
    const themeStyle = document.createElement("style");
    themeStyle.id = "cb-theme-vars";
    themeStyle.textContent = `
      #cb-bubble {
        background: ${theme.bubbleColor} !important;
        box-shadow: 0 4px 20px ${theme.bubbleColor}55 !important;
      }
      #cb-header {
        background: ${theme.headerColor} !important;
      }
      .cb-msg-av {
        background: ${theme.userMsgColor} !important;
      }
      .cb-empty-icon {
        background: ${theme.headerColor} !important;
      }
      .cb-bubble-msg.user {
        background: ${theme.userMsgColor} !important;
        box-shadow: 0 2px 8px ${theme.userMsgColor}44 !important;
      }
      #cb-send {
        background: ${theme.sendBtnColor} !important;
        box-shadow: 0 2px 6px ${theme.sendBtnColor}55 !important;
        border-radius: 9px !important;
      }
      #cb-footer a {
        color: ${theme.accentColor} !important;
      }
      #cb-input-row:focus-within {
        border-color: ${theme.accentColor}88 !important;
      }
      .cb-suggestion:hover {
        color: ${theme.accentColor} !important;
        border-color: ${theme.accentColor}44 !important;
        background: ${theme.accentColor}11 !important;
      }
    `;
    document.head.appendChild(themeStyle);
  
    // Also update bubble inline style directly
    if (bubble) {
      bubble.style.background = theme.bubbleColor;
    }
  }

  // ── Build UI ──────────────────────────────────────────────
  const bubble = document.createElement("button");
  bubble.id = "cb-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.innerHTML = sparkSVG + `<span class="cb-badge"></span>`;
  document.body.appendChild(bubble);

  const win = document.createElement("div");
  win.id = "cb-window";
  win.classList.add("cb-hidden");
  win.innerHTML = `
    <div id="cb-header">
      <div id="cb-avatar">${sparkSVG}</div>
      <div id="cb-header-info">
        <div id="cb-header-name">AI Assistant</div>
        <div id="cb-status">
          <div id="cb-status-dot"></div>
          <span id="cb-status-text">Online</span>
        </div>
      </div>
      <button id="cb-close-btn" aria-label="Close">${closeSVG}</button>
    </div>
    <div id="cb-messages"></div>
    <div id="cb-input-area">
      <div id="cb-input-row">
        <input id="cb-input" placeholder="Ask a question..." autocomplete="off"/>
        <button id="cb-send" disabled aria-label="Send">${sendSVG}</button>
      </div>
      <div id="cb-footer">Powered by <a href="${BASE_URL}" target="_blank">Nocta</a></div>
    </div>
  `;
  document.body.appendChild(win);

  const messagesEl = win.querySelector("#cb-messages");
  const inputEl = win.querySelector("#cb-input");
  const sendBtn = win.querySelector("#cb-send");
  const statusDot = win.querySelector("#cb-status-dot");
  const statusText = win.querySelector("#cb-status-text");
  const closeBtn = win.querySelector("#cb-close-btn");

  function renderMessages() {
    messagesEl.innerHTML = "";

    if (messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cb-empty";
      empty.innerHTML = `
        <div class="cb-empty-icon">${sparkSVG}</div>
        <div class="cb-empty-title">Hi there! 👋</div>
        <div class="cb-empty-sub">I'm trained on this website's content. Ask me anything!</div>
        <div class="cb-suggestions">
          ${SUGGESTIONS.map(s => `<button class="cb-suggestion">${s}</button>`).join("")}
        </div>
      `;
      empty.querySelectorAll(".cb-suggestion").forEach(btn => {
        btn.addEventListener("click", () => sendMessage(btn.textContent));
      });
      messagesEl.appendChild(empty);
      if (currentTheme) applyTheme(currentTheme);
      return;
    }

    messages.forEach(msg => {
      const row = document.createElement("div");
      row.className = `cb-msg-row ${msg.role}`;

      if (msg.role === "assistant") {
        const bubble = document.createElement("div");
        bubble.className = "cb-msg-av";
        bubble.innerHTML = sparkSVG;

        const content = document.createElement("div");
        content.className = "cb-bubble-msg assistant";
        // ── FIX 1 APPLIED: render markdown as HTML ──
        content.innerHTML = parseMarkdown(msg.content);

        row.appendChild(bubble);
        row.appendChild(content);
      } else {
        const content = document.createElement("div");
        content.className = "cb-bubble-msg user";
        content.textContent = msg.content; // user messages: plain text only
        row.appendChild(content);
      }

      messagesEl.appendChild(row);
    });

    if (loading) {
      const typingRow = document.createElement("div");
      typingRow.className = "cb-msg-row";
      typingRow.innerHTML = `
        <div class="cb-msg-av">${sparkSVG}</div>
        <div class="cb-typing">
          <div class="cb-typing-dot"></div>
          <div class="cb-typing-dot"></div>
          <div class="cb-typing-dot"></div>
        </div>
      `;
      messagesEl.appendChild(typingRow);
    }

    setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 50);
  }

  function setLoading(val) {
    loading = val;
    sendBtn.disabled = val || !inputEl.value.trim();
    statusDot.className = val ? "typing" : "";
    statusText.textContent = val ? "Typing..." : "Online";
  }

  // ── FIX 3: Clean streaming sendMessage ────────────────────
  async function sendMessage(text) {
    const userText = (text || inputEl.value).trim();
    if (!userText || loading) return;

    messages.push({ role: "user", content: userText });
    saveMessages();
    inputEl.value = "";
    sendBtn.disabled = true;
    setLoading(true);
    renderMessages();

    const prevError = messagesEl.querySelector(".cb-error");
    if (prevError) prevError.remove();

    try {
      const res = await fetch(BASE_URL + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      // Add empty assistant message to stream into
      messages.push({ role: "assistant", content: "" });
      saveMessages();
      renderMessages();

      // Get the streaming bubble
      const allBubbles = messagesEl.querySelectorAll(".cb-bubble-msg.assistant");
      const streamBubble = allBubbles[allBubbles.length - 1];

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data:"));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace("data: ", ""));

            if (data.token && streamBubble) {
              streamedText += data.token;
              // ── FIX 1 APPLIED: parse markdown during stream ──
              streamBubble.innerHTML = parseMarkdown(streamedText);
              messagesEl.scrollTop = messagesEl.scrollHeight;
              await new Promise(resolve => setTimeout(resolve, 18));
            }

            if (data.done) {
              messages[messages.length - 1].content = streamedText;

              saveMessages();

              // ✅ stop typing state immediately
              setLoading(false);

              // ✅ remove typing dots instantly
              renderMessages();

              break;
            }

            if (data.error) throw new Error(data.error);
          } catch { }
        }
      }
      reader.releaseLock();

    } catch (err) {
      // Remove empty assistant message if failed
      if (messages[messages.length - 1]?.content === "") {
        messages.pop();
      }
      const errorEl = document.createElement("div");
      errorEl.className = "cb-error";
      errorEl.textContent = "⚠️ " + (err.message || "Something went wrong.");
      messagesEl.appendChild(errorEl);
    } finally {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      inputEl.focus();
    }
  }

  inputEl.addEventListener("input", () => {
    sendBtn.disabled = !inputEl.value.trim() || loading;
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener("click", () => sendMessage());

  let isOpen = false;

  function openChat() {
    isOpen = true;
    win.classList.remove("cb-hidden");
    bubble.innerHTML = closeSVG;
    bubble.style.background = currentTheme?.bubbleColor || "var(--cb-primary)";
    saveOpenState(true);
    setTimeout(() => inputEl.focus(), 300);
  }

  function closeChat() {
    isOpen = false;
    win.classList.add("cb-hidden");
    bubble.innerHTML = sparkSVG + `<span class="cb-badge"></span>`;
    bubble.style.background = currentTheme?.bubbleColor || "var(--cb-primary)";
    saveOpenState(false);
  }

  bubble.addEventListener("click", () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener("click", closeChat);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closeChat();
  });

  // ── Init ──────────────────────────────────────────────────
  messages = loadMessages();
  renderMessages();

  loadTheme().then((theme) => {
    if (theme) {
      applyTheme(theme);
      renderMessages(); // re-render with theme colors
    }
    if (loadOpenState()) openChat();
  });

})();