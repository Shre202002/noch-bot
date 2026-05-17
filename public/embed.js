(function() {
  const script = document.currentScript;
  const userId = script ? script.getAttribute('data-user-id') : null;

  // ✅ FIX 1: BASE_URL from script src, not window.location
  const BASE_URL = script.getAttribute('data-api') ||
    script.src.replace('/embed.js', '').replace(/\/$/, '');

  if (!userId) {
    console.error('NochBot: Missing data-user-id attribute.');
    return;
  }

  // --- PERSISTENT IDS ---
  const VISITOR_KEY = 'nb_visitor_' + userId;
  const SESSION_KEY = 'nb_session_' + userId;

  const getVisitorId = () => {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) { id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36); localStorage.setItem(VISITOR_KEY, id); }
    return id;
  };

  const getSessionId = () => {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = 's_' + Math.random().toString(36).substring(2) + Date.now().toString(36); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  };

  // --- DEFAULT THEME ---
  var theme = {
    bubbleColor: '#000000',
    headerColor: '#111111',
    userMsgColor: '#ffffff',
    sendBtnColor: '#ffffff',
    accentColor: '#36f4a4'
  };

  // --- APPLY THEME ---
  function applyTheme(t) {
    if (!t) return;
    theme = t;
    var bubble = document.getElementById('nb-bubble');
    var header = document.getElementById('nb-header');
    var sendBtn = document.getElementById('nb-send');
    if (bubble) bubble.style.background = t.bubbleColor;
    if (header) header.style.background = t.headerColor;
    if (sendBtn) {
      sendBtn.style.background = t.sendBtnColor;
      // send icon color — invert if light button
      var icon = sendBtn.querySelector('svg');
      if (icon) icon.style.stroke = isLight(t.sendBtnColor) ? '#000' : '#fff';
    }

    var old = document.getElementById('nb-theme-css');
    if (old) old.remove();
    var s = document.createElement('style');
    s.id = 'nb-theme-css';
    s.innerHTML =
      '#nb-bubble{background:' + t.bubbleColor + '!important}' +
      '#nb-header{background:' + t.headerColor + '!important}' +
      '#nb-send{background:' + t.sendBtnColor + '!important}' +
      '.nb-user-msg{background:' + t.userMsgColor + '!important;color:' + (isLight(t.userMsgColor) ? '#000' : '#fff') + '!important}' +
      '#nb-input:focus{border-color:' + t.accentColor + '!important}';
    document.head.appendChild(s);
  }

  function isLight(hex) {
    var c = hex.replace('#','');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
    return (r*299 + g*587 + b*114) / 1000 > 128;
  }

  // --- LOAD CONFIG (theme + botName + botIcon) ---
  function loadConfig() {
    fetch(BASE_URL + '/api/theme?userId=' + userId + '&t=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(function(d) {
        // Apply theme
        if (d.theme) applyTheme(d.theme);

        // Apply bot name
        if (d.botName) {
          var nameEl = document.getElementById('nb-bot-name');
          if (nameEl) nameEl.innerText = d.botName;
        }

        // Apply bot icon
        if (d.botIcon) {
          var logoEl = document.getElementById('nb-bubble-logo');
          if (logoEl) logoEl.src = d.botIcon;
          var headerIcon = document.getElementById('nb-header-icon');
          if (headerIcon) headerIcon.src = d.botIcon;
        }
      })
      .catch(function(e) { console.warn('NochBot: Config load failed', e); });
  }

  // --- INIT UI ---
  function init() {
    // Inject styles
    var style = document.createElement('style');
    style.innerHTML = `
      #nb-bubble {
        position: fixed !important; bottom: 24px !important; right: 24px !important;
        top: auto !important; left: auto !important;
        width: 60px; height: 60px; border-radius: 50%;
        background: #000; cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        display: flex; align-items: center; justify-content: center;
        z-index: 2147483647 !important;
        border: 1px solid rgba(255,255,255,0.1);
        transition: transform 0.2s ease; overflow: hidden;
      }
      #nb-bubble:hover { transform: scale(1.08); }
      #nb-window {
        position: fixed !important; bottom: 96px !important; right: 24px !important;
        top: auto !important; left: auto !important;
        width: 380px; height: 560px; max-height: calc(100vh - 110px);
        background: #0a0a0a; border-radius: 20px;
        display: flex; flex-direction: column;
        box-shadow: 0 24px 48px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.08);
        overflow: hidden; z-index: 2147483646 !important;
        opacity: 0; pointer-events: none;
        transform: scale(0.95) translateY(10px);
        transform-origin: bottom right;
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      #nb-window.nb-open { opacity: 1; pointer-events: auto; transform: scale(1) translateY(0); }
      #nb-header {
        background: #111; padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        display: flex; align-items: center; gap: 12px; flex-shrink: 0;
      }
      #nb-header-icon {
        width: 32px; height: 32px; border-radius: 8px; object-fit: cover;
      }
      #nb-bot-name { color: #fff; font-weight: 600; font-size: 14px; flex: 1; }
      #nb-status { display: flex; align-items: center; gap: 6px; }
      #nb-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; }
      #nb-messages {
        flex: 1; min-height: 0; overflow-y: auto; padding: 16px;
        display: flex; flex-direction: column; gap: 10px;
        background: #0a0a0a;
      }
      #nb-messages::-webkit-scrollbar { width: 3px; }
      #nb-messages::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      .nb-msg {
        padding: 10px 14px; border-radius: 16px; font-size: 13px;
        line-height: 1.55; max-width: 82%; word-break: break-word;
      }
      .nb-user-msg {
        align-self: flex-end; background: #fff; color: #000;
        border-bottom-right-radius: 4px;
      }
      .nb-bot-msg {
        align-self: flex-start; background: rgba(255,255,255,0.06);
        color: #fff; border-bottom-left-radius: 4px;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .nb-typing { display: flex; gap: 4px; align-items: center; padding: 12px 14px; }
      .nb-typing span {
        width: 6px; height: 6px; border-radius: 50%; background: #555;
        animation: nb-bounce 1.2s infinite ease;
      }
      .nb-typing span:nth-child(2) { animation-delay: 0.2s; }
      .nb-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes nb-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
      #nb-input-area {
        padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.06);
        display: flex; gap: 8px; align-items: center;
        background: #0a0a0a; flex-shrink: 0;
      }
      #nb-input {
        flex: 1; background: rgba(255,255,255,0.06);
        border: 1.5px solid rgba(255,255,255,0.1);
        border-radius: 999px; padding: 9px 16px;
        color: #fff; font-size: 13px; outline: none;
        font-family: inherit; min-width: 0;
        transition: border-color 0.15s;
      }
      #nb-input::placeholder { color: rgba(255,255,255,0.3); }
      #nb-input:focus { border-color: #36f4a4; }
      #nb-send {
        background: #fff; border: none; width: 36px; height: 36px;
        border-radius: 50%; cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: opacity 0.2s, transform 0.15s;
      }
      #nb-send:hover { transform: scale(1.05); }
      #nb-send:disabled { opacity: 0.4; cursor: not-allowed; }
      #nb-footer {
        text-align: center; padding: 6px 0 8px;
        font-size: 10px; color: rgba(255,255,255,0.25);
        background: #0a0a0a; flex-shrink: 0;
      }
      #nb-footer a { color: rgba(255,255,255,0.35); text-decoration: none; }
      @media(max-width:480px) {
        #nb-window { width: calc(100vw - 16px) !important; height: calc(100dvh - 100px) !important; right: 8px !important; bottom: 84px !important; }
      }
    `;
    document.head.appendChild(style);

    // Build window
    var win = document.createElement('div');
    win.id = 'nb-window';
    win.innerHTML =
      '<div id="nb-header">' +
        '<img id="nb-header-icon" src="' + BASE_URL + '/Noch-bot-logo.svg" onerror="this.style.display=\'none\'" />' +
        '<span id="nb-bot-name">NochBot Assistant</span>' +
        '<div id="nb-status"><div id="nb-status-dot"></div></div>' +
      '</div>' +
      '<div id="nb-messages">' +
        '<div class="nb-msg nb-bot-msg">Hi! I\'m your AI assistant. How can I help you today?</div>' +
      '</div>' +
      '<div id="nb-input-area">' +
        '<input type="text" id="nb-input" placeholder="Ask a question..." autocomplete="off" />' +
        '<button id="nb-send" aria-label="Send">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
        '</button>' +
      '</div>' +
      '<div id="nb-footer">Powered by <a href="https://nochbot.space" target="_blank">NochBot</a></div>';
    document.body.appendChild(win);

    // Build bubble
    var bubble = document.createElement('button');
    bubble.id = 'nb-bubble';
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.innerHTML = '<img id="nb-bubble-logo" src="' + BASE_URL + '/Noch-bot-logo.svg" style="width:28px;height:auto;" onerror="this.outerHTML=\'<svg width=26 height=26 viewBox=&quot;0 0 24 24&quot; fill=none stroke=white stroke-width=2 stroke-linecap=round><path d=&quot;M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z&quot;></path></svg>\'" />';
    document.body.appendChild(bubble);

    var inputEl  = document.getElementById('nb-input');
    var sendBtn  = document.getElementById('nb-send');
    var msgDiv   = document.getElementById('nb-messages');

    // Open/close
    var isOpen = false;
    var closeSVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var chatSVG  = '<img id="nb-bubble-logo" src="' + BASE_URL + '/Noch-bot-logo.svg" style="width:28px;height:auto;" />';

    bubble.addEventListener('click', function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      if (isOpen) {
        win.classList.add('nb-open');
        bubble.innerHTML = closeSVG;
        setTimeout(function() { inputEl.focus(); }, 250);
      } else {
        win.classList.remove('nb-open');
        bubble.innerHTML = chatSVG;
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) {
        win.classList.remove('nb-open');
        bubble.innerHTML = chatSVG;
        isOpen = false;
      }
    });

    // Messages
    function addMsg(role, text) {
      var m = document.createElement('div');
      m.className = 'nb-msg ' + (role === 'user' ? 'nb-user-msg' : 'nb-bot-msg');
      if (text) m.innerText = text;
      msgDiv.appendChild(m);
      msgDiv.scrollTop = msgDiv.scrollHeight;
      return m;
    }

    function addTyping() {
      var m = document.createElement('div');
      m.className = 'nb-msg nb-bot-msg nb-typing';
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

      fetch(BASE_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          userId: userId,
          visitorId: getVisitorId(),
          sessionId: getSessionId(),
          sourceUrl: window.location.href,
          metadata: {
            browser: navigator.userAgent.slice(0, 100),
            device: window.innerWidth < 768 ? 'mobile' : 'desktop',
            referrer: document.referrer
          }
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        typing.remove();
        var full = data.error ? ('⚠️ ' + data.error) : (data.text || "Sorry, couldn't process that.");
        var bot = addMsg('bot', '');
        var i = 0;
        var iv = setInterval(function() {
          bot.innerText = full.slice(0, i + 1);
          i++;
          msgDiv.scrollTop = msgDiv.scrollHeight;
          if (i >= full.length) clearInterval(iv);
        }, 12);
      })
      .catch(function() {
        typing.remove();
        addMsg('bot', '⚠️ Connection error. Please try again.');
      })
      .finally(function() {
        sending = false;
        sendBtn.disabled = false;
        inputEl.focus();
      });
    }

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    // Load theme after UI is ready
    loadConfig();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }

})();