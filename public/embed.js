(function() {
  /**
   * NochBot Embedded Widget SDK
   * Handles visitor lifecycle, real-time chat, and behavioral analytics.
   */

  const script = document.currentScript;
  const userId = script ? script.getAttribute('data-user-id') : null;
  const BASE_URL = window.location.origin;

  if (!userId) {
    console.error('NochBot: Missing data-user-id attribute.');
    return;
  }

  // --- PERSISTENT IDS ---
  const VISITOR_KEY = 'nb_visitor_' + userId;
  const SESSION_KEY = 'nb_session_' + userId;
  const CONSENT_KEY = 'nb_cookie_consent';

  const getVisitorId = () => {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  };

  const getSessionId = () => {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 's_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  };

  const hasConsent = () => localStorage.getItem(CONSENT_KEY) === 'accepted';

  // --- ANALYTICS ---
  const track = (event, metadata = {}) => {
    if (!hasConsent()) return;
    
    const payload = {
      event,
      userId,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      sourceUrl: window.location.href,
      metadata: {
        ...metadata,
        browser: navigator.userAgent,
        device: window.innerWidth < 768 ? 'mobile' : 'desktop',
        referrer: document.referrer
      }
    };

    fetch(BASE_URL + '/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  };

  // --- UI CREATION ---
  function init() {
    const container = document.createElement('div');
    container.id = 'nb-widget-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;font-family:sans-serif;';
    document.body.appendChild(container);

    const bubble = document.createElement('div');
    bubble.id = 'nb-bubble';
    bubble.style.cssText = 'width:60px;height:60px;border-radius:30px;background:#000;display:flex;align-items:center;justify-center;cursor:pointer;box-shadow:0 12px 24px rgba(0,0,0,0.2);transition:all 0.3s cubic-bezier(0.16,1,0.3,1);overflow:hidden;border:1px solid rgba(255,255,255,0.1);';
    bubble.innerHTML = `<img src="${BASE_URL}/Noch-bot-logo.svg" style="width:28px;height:auto;filter:invert(1);transition:transform 0.3s ease;">`;
    
    const chatWindow = document.createElement('div');
    chatWindow.id = 'nb-window';
    chatWindow.style.cssText = 'position:absolute;bottom:80px;right:0;width:380px;height:580px;max-height:80vh;background:#0a0a0a;border-radius:24px;display:none;flex-direction:column;box-shadow:0 24px 48px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);overflow:hidden;transform:translateY(20px);opacity:0;transition:all 0.3s ease;';
    
    container.appendChild(chatWindow);
    container.appendChild(bubble);

    let isOpen = false;

    bubble.onclick = () => {
      isOpen = !isOpen;
      if (isOpen) {
        chatWindow.style.display = 'flex';
        setTimeout(() => {
          chatWindow.style.opacity = '1';
          chatWindow.style.transform = 'translateY(0)';
        }, 10);
        track('chat_opened');
      } else {
        chatWindow.style.opacity = '0';
        chatWindow.style.transform = 'translateY(20px)';
        setTimeout(() => chatWindow.style.display = 'none', 300);
      }
    };

    // Simple Chat implementation
    chatWindow.innerHTML = `
      <div style="background:#111;padding:20px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:12px;">
        <div style="width:10px;height:10px;border-radius:5px;background:#4ade80;"></div>
        <span style="color:#fff;font-weight:600;font-size:14px;">NochBot Assistant</span>
      </div>
      <div id="nb-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;">
        <div style="background:rgba(255,255,255,0.05);color:#fff;padding:12px 16px;border-radius:18px 18px 18px 4px;font-size:13px;max-width:85%;line-height:1.5;">
          Hi! I'm your AI assistant. How can I help you today?
        </div>
      </div>
      <div style="padding:16px;border-top:1px solid rgba(255,255,255,0.05);background:#0a0a0a;display:flex;gap:8px;">
        <input id="nb-input" placeholder="Type a message..." style="flex:1;background:rgba(255,255,255,0.05);border:none;border-radius:99px;padding:10px 16px;color:#fff;font-size:13px;outline:none;">
        <button id="nb-send" style="background:#fff;border:none;width:36px;height:36px;border-radius:18px;cursor:pointer;display:flex;align-items:center;justify-center;transition:opacity 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    `;

    const input = document.getElementById('nb-input');
    const send = document.getElementById('nb-send');
    const messages = document.getElementById('nb-messages');

    function appendMessage(role, content) {
      const msg = document.createElement('div');
      const isUser = role === 'user';
      msg.style.cssText = `padding:12px 16px;border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};font-size:13px;max-width:85%;line-height:1.5;align-self:${isUser ? 'flex-end' : 'flex-start'};background:${isUser ? '#fff' : 'rgba(255,255,255,0.05)'};color:${isUser ? '#000' : '#fff'};`;
      msg.innerText = content;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      
      input.value = '';
      appendMessage('user', text);
      track('message_sent', { length: text.length });

      try {
        const start = Date.now();
        const res = await fetch(BASE_URL + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: text }],
            userId,
            visitorId: getVisitorId(),
            sessionId: getSessionId()
          })
        });
        const data = await res.json();
        const responseTime = Date.now() - start;
        
        appendMessage('assistant', data.text);
        track('response_generated', { responseTimeMs: responseTime });
      } catch (err) {
        appendMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        track('message_failed');
      }
    }

    send.onclick = sendMessage;
    input.onkeydown = (e) => e.key === 'Enter' && sendMessage();

    track('widget_loaded');
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
