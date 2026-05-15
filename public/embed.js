(function () {
  const scriptTag = document.currentScript;
  const userId = scriptTag.getAttribute('data-user-id');
  const baseUrl = scriptTag.getAttribute('data-api') ||
    scriptTag.src.replace('/embed.js', '');

  if (!userId) {
    console.error('[NochBot] Missing data-user-id attribute');
    return;
  }

  const SESSION_KEY = 'nochbot_session_' + userId;
  const VISITOR_KEY = 'nochbot_visitor_' + userId;

  function getOrCreate(key) {
    try {
      let val = localStorage.getItem(key);
      if (!val) {
        val = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem(key, val);
      }
      return val;
    } catch (e) { return 'v_' + Math.random().toString(36).substr(2, 9); }
  }

  const sessionId = getOrCreate(SESSION_KEY);
  const visitorId = getOrCreate(VISITOR_KEY);

  const style = document.createElement('style');
  style.innerHTML = `
      #nochbot-bubble {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        top: auto !important;
        left: auto !important;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #36f4a4;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        outline: none;
        z-index: 2147483647 !important;
        transition: transform 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #nochbot-bubble:hover { transform: scale(1.08); }

      #nochbot-window {
        position: fixed !important;
        bottom: 96px !important;
        right: 24px !important;
        top: auto !important;
        left: auto !important;
        width: 370px;
        height: 560px;
        max-height: calc(100vh - 120px);
        background: #fff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06);
        display: flex;
        flex-direction: column;
        z-index: 2147483646 !important;
        opacity: 0;
        pointer-events: none;
        transform: scale(0.95) translateY(10px);
        transform-origin: bottom right;
        transition: opacity 0.25s ease, transform 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #nochbot-window.nb-open {
        opacity: 1;
        pointer-events: auto;
        transform: scale(1) translateY(0);
      }
      #nochbot-header {
        padding: 14px 16px;
        background: #36f4a4;
        color: #000;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      #nochbot-header-avatar {
        width: 34px; height: 34px; border-radius: 10px;
        background: rgba(0,0,0,0.1);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; flex-shrink: 0; overflow: hidden;
      }
      #nochbot-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
      #nochbot-header-name { font-weight: 600; font-size: 14px; flex: 1; }
      #nochbot-messages {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 16px;
        background: #f9fafb;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #nochbot-messages::-webkit-scrollbar { width: 3px; }
      #nochbot-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
      .nb-msg {
        max-width: 82%; padding: 10px 14px; border-radius: 18px;
        font-size: 14px; line-height: 1.55; word-break: break-word;
      }
      .nb-msg-user {
        align-self: flex-end; background: #36f4a4; color: #000;
        border-bottom-right-radius: 4px;
      }
      .nb-msg-bot {
        align-self: flex-start; background: #fff;
        border: 1px solid #e5e7eb; color: #1f2937;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      }
      .nb-typing {
        display: flex; gap: 4px; align-items: center;
        padding: 12px 14px;
      }
      .nb-typing span {
        width: 6px; height: 6px; border-radius: 50%;
        background: #bbb; animation: nb-bounce 1.2s infinite ease;
      }
      .nb-typing span:nth-child(2) { animation-delay: 0.2s; }
      .nb-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes nb-bounce {
        0%,60%,100% { transform: translateY(0); }
        30% { transform: translateY(-5px); }
      }
      #nochbot-input-area {
        padding: 12px 14px; border-top: 1px solid #e5e7eb;
        display: flex; gap: 8px; align-items: center;
        background: #fff; flex-shrink: 0;
      }
      #nochbot-input {
        flex: 1; border: 1.5px solid #e5e7eb; border-radius: 999px;
        padding: 9px 16px; outline: none; font-size: 14px;
        font-family: inherit; background: #f9fafb; color: #111;
        transition: border-color 0.15s; min-width: 0;
      }
      #nochbot-input:focus { border-color: #36f4a4; background: #fff; }
      #nochbot-input::placeholder { color: #bbb; }
      #nochbot-send {
        background: #36f4a4; border: none;
        width: 38px; height: 38px; border-radius: 50%;
        cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: opacity 0.2s, transform 0.15s; flex-shrink: 0;
      }
      #nochbot-send:hover { transform: scale(1.05); }
      #nochbot-send:disabled { opacity: 0.4; cursor: not-allowed; }
      #nochbot-footer {
        text-align: center; padding: 6px 0 8px;
        font-size: 10px; color: #ccc; background: #fff; flex-shrink: 0;
      }
      #nochbot-footer a { color: #aaa; text-decoration: none; }
      @media (max-width: 480px) {
        #nochbot-window {
          width: calc(100vw - 16px) !important;
          height: calc(100dvh - 100px) !important;
          bottom: 84px !important;
          right: 8px !important;
        }
      }
    `;
  document.head.appendChild(style);

  const chatSVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  const closeSVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const sendSVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

  // Build window
  const win = document.createElement('div');
  win.id = 'nochbot-window';
  win.innerHTML =
    '<div id="nochbot-header">' +
    '<div id="nochbot-header-avatar">🤖</div>' +
    '<div id="nochbot-header-name">Assistant</div>' +
    '</div>' +
    '<div id="nochbot-messages"></div>' +
    '<div id="nochbot-input-area">' +
    '<input type="text" id="nochbot-input" placeholder="Ask a question..." autocomplete="off" />' +
    '<button id="nochbot-send" aria-label="Send">' + sendSVG + '</button>' +
    '</div>' +
    '<div id="nochbot-footer">Powered by <a href="https://nochbot.space" target="_blank">NochBot</a></div>';
  document.body.appendChild(win);

  // Build bubble — appended AFTER window so it paints on top
  const bubbleBtn = document.createElement('button');
  bubbleBtn.id = 'nochbot-bubble';
  bubbleBtn.setAttribute('aria-label', 'Open chat');
  bubbleBtn.innerHTML = chatSVG;
  document.body.appendChild(bubbleBtn);

  const inputEl = document.getElementById('nochbot-input');
  const sendBtn = document.getElementById('nochbot-send');
  const msgDiv = document.getElementById('nochbot-messages');
  const hdrName = document.getElementById('nochbot-header-name');
  const hdrAvatar = document.getElementById('nochbot-header-avatar');

  // Load config — applies botColor + theme object
  fetch(baseUrl + '/api/theme?userId=' + userId + '&t=' + Date.now())
    .then(function (r) { return r.json(); })

    .then(function (d) {
      if (d.botName) hdrName.innerText = d.botName;
      if (d.botIcon) hdrAvatar.innerHTML = '<img src="' + d.botIcon + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />';

      // Theme apply
      var t = d.theme || {};
      var bubble = t.bubbleColor || '#36f4a4';
      var header = t.headerColor || '#36f4a4';
      var userMsg = t.userMsgColor || '#36f4a4';
      var sendBt = t.sendBtnColor || '#36f4a4';

      bubbleBtn.style.setProperty('background', bubble, 'important');
      document.getElementById('nochbot-header').style.setProperty('background', header, 'important');
      sendBtn.style.setProperty('background', sendBt, 'important');

      var old = document.getElementById('nb-theme-style');
      if (old) old.remove();
      var s = document.createElement('style');
      s.id = 'nb-theme-style';
      s.innerHTML = '#nochbot-bubble{background:' + bubble + '!important}.nb-msg-user{background:' + userMsg + '!important}#nochbot-send{background:' + sendBt + '!important}#nochbot-header{background:' + header + '!important}';
      document.head.appendChild(s);
    })
  // .then(function (d) {
  //   // Bot name
  //   if (d.botName) hdrName.innerText = d.botName;

  //   // Bot icon
  //   if (d.botIcon) hdrAvatar.innerHTML = '<img src="' + d.botIcon + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />';

  //   // Resolve primary color — theme object takes priority over botColor
  //   var t = d.theme || {};
  //   var bubbleColor = t.bubbleColor || d.botColor || '#36f4a4';
  //   var headerColor = t.headerColor || d.botColor || '#36f4a4';
  //   var userMsgColor = t.userMsgColor || d.botColor || '#36f4a4';
  //   var sendBtnColor = t.sendBtnColor || d.botColor || '#36f4a4';
  //   var accentColor = t.accentColor || d.botColor || '#36f4a4';

  //   // Apply colors directly to elements
  //   bubbleBtn.style.background = bubbleColor;
  //   document.getElementById('nochbot-header').style.background = headerColor;
  //   sendBtn.style.background = sendBtnColor;

  //   // Inject dynamic CSS for all color-dependent parts
  //   var old = document.getElementById('nb-theme-style');
  //   if (old) old.remove();
  //   var s = document.createElement('style');
  //   s.id = 'nb-theme-style';
  //   s.innerHTML = [
  //     '.nb-msg-user { background: ' + userMsgColor + ' !important; }',
  //     '#nochbot-input:focus { border-color: ' + accentColor + ' !important; }',
  //     '#nochbot-bubble { background: ' + bubbleColor + ' !important; }',
  //     '#nochbot-header { background: ' + headerColor + ' !important; }',
  //     '#nochbot-send { background: ' + sendBtnColor + ' !important; }',
  //   ].join(' ');
  //   document.head.appendChild(s);
  // })
  // .catch(function () { });

  // Open / close
  var isOpen = false;

  function openChat() {
    isOpen = true;
    win.classList.add('nb-open');
    bubbleBtn.innerHTML = closeSVG;
    setTimeout(function () { inputEl.focus(); }, 250);
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('nb-open');
    bubbleBtn.innerHTML = chatSVG;
  }

  bubbleBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (isOpen) closeChat(); else openChat();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  // Messages
  function addMsg(role, text) {
    var m = document.createElement('div');
    m.className = 'nb-msg nb-msg-' + role;
    if (text) m.innerText = text;
    msgDiv.appendChild(m);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return m;
  }

  function addTyping() {
    var m = document.createElement('div');
    m.className = 'nb-msg nb-msg-bot nb-typing';
    m.innerHTML = '<span></span><span></span><span></span>';
    msgDiv.appendChild(m);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return m;
  }

  // Send
  var sending = false;

  function send() {
    var text = inputEl.value.trim();
    if (!text || sending) return;
    sending = true;
    sendBtn.disabled = true;
    inputEl.value = '';

    addMsg('user', text);
    var typing = addTyping();

    fetch(baseUrl + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        userId: userId,
        sessionId: sessionId,
        visitorId: visitorId,
        sourceUrl: window.location.href,
        metadata: {
          browser: navigator.userAgent.slice(0, 100),
          device: window.innerWidth < 768 ? 'mobile' : 'desktop',
          referrer: document.referrer
        }
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.remove();
        var full = data.error ? ('⚠️ ' + data.error) : (data.text || "Sorry, couldn't process that.");
        var bot = addMsg('bot', '');
        var i = 0;
        var iv = setInterval(function () {
          bot.innerText = full.slice(0, i + 1);
          i++;
          msgDiv.scrollTop = msgDiv.scrollHeight;
          if (i >= full.length) clearInterval(iv);
        }, 12);
      })
      .catch(function () {
        typing.remove();
        addMsg('bot', '⚠️ Connection error. Please try again.');
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
        inputEl.focus();
      });
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

})();