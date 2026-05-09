(function() {
  const scriptTag = document.currentScript;
  const userId = scriptTag.getAttribute('data-user-id');
  const baseUrl = scriptTag.src.split('/embed.js')[0];

  if (!userId) {
    console.error('[Nochq] Missing data-user-id attribute');
    return;
  }

  // Persistent IDs using localStorage
  const SESSION_KEY = `nochq_session_${userId}`;
  const VISITOR_KEY = `nochq_visitor_${userId}`;

  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  let botName = 'Assistant';
  let botColor = '#36f4a4';
  let botIcon = '';
  let theme = null;

  // Load configuration
  fetch(`${baseUrl}/api/knowledge/config?userId=${userId}`)
    .then(r => r.json())
    .then(d => {
      if (d.botName) botName = d.botName;
      if (d.botColor) botColor = d.botColor;
      if (d.botIcon) botIcon = d.botIcon;
      if (d.theme) theme = d.theme;
      initChat();
    }).catch(e => {
      console.warn('[Nochq] Config fetch failed, using defaults');
      initChat();
    });

  function initChat() {
    const container = document.createElement('div');
    container.id = 'nochq-chat-widget';
    document.body.appendChild(container);

    const style = document.createElement('style');
    style.innerHTML = `
      #nochq-chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: system-ui, -apple-system, sans-serif; }
      #nochq-chat-bubble { width: 56px; height: 56px; border-radius: 50%; background: ${botColor}; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }
      #nochq-chat-bubble:hover { transform: scale(1.05); }
      #nochq-chat-window { position: absolute; bottom: 70px; right: 0; width: 360px; height: 540px; background: white; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; }
      #nochq-chat-header { background: ${botColor}; color: white; padding: 16px; display: flex; align-items: center; gap: 12px; }
      #nochq-chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; }
      .nochq-msg { max-width: 80%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; }
      .nochq-msg-user { align-self: flex-end; background: ${botColor}; color: white; border-bottom-right-radius: 2px; }
      .nochq-msg-bot { align-self: flex-start; background: white; color: #1f2937; border-bottom-left-radius: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #f3f4f6; }
      #nochq-chat-input-area { padding: 12px; border-top: 1px solid #f3f4f6; display: flex; gap: 8px; background: white; }
      #nochq-chat-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 20px; padding: 8px 16px; outline: none; font-size: 14px; }
      #nochq-chat-send { background: ${botColor}; color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .nochq-dots { display: flex; gap: 4px; padding: 4px 0; }
      .nochq-dot { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: nochq-bounce 1.4s infinite ease-in-out; }
      .nochq-dot:nth-child(2) { animation-delay: 0.2s; }
      .nochq-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes nochq-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
    `;
    document.head.appendChild(style);

    const bubble = document.createElement('div');
    bubble.id = 'nochq-chat-bubble';
    bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    container.appendChild(bubble);

    const chatWindow = document.createElement('div');
    chatWindow.id = 'nochq-chat-window';
    chatWindow.innerHTML = `
      <div id="nochq-chat-header">
        <div style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">🤖</div>
        <div style="flex:1 font-weight:600; font-size:15px;">${botName}</div>
        <div id="nochq-chat-close" style="cursor:pointer; opacity:0.8;">✕</div>
      </div>
      <div id="nochq-chat-messages"></div>
      <div id="nochq-chat-input-area">
        <input type="text" id="nochq-chat-input" placeholder="Type a message...">
        <button id="nochq-chat-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    `;
    container.appendChild(chatWindow);

    const msgsContainer = chatWindow.querySelector('#nochq-chat-messages');
    const input = chatWindow.querySelector('#nochq-chat-input');
    const sendBtn = chatWindow.querySelector('#nochq-chat-send');
    const closeBtn = chatWindow.querySelector('#nochq-chat-close');

    let chatHistory = [];

    bubble.onclick = () => { chatWindow.style.display = 'flex'; bubble.style.display = 'none'; };
    closeBtn.onclick = () => { chatWindow.style.display = 'none'; bubble.style.display = 'flex'; };

    function addMessage(role, content) {
      const msg = document.createElement('div');
      msg.className = `nochq-msg nochq-msg-${role}`;
      msg.innerText = content;
      msgsContainer.appendChild(msg);
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
      return msg;
    }

    function addDots() {
      const msg = document.createElement('div');
      msg.className = 'nochq-msg nochq-msg-bot';
      msg.innerHTML = '<div class="nochq-dots"><div class="nochq-dot"></div><div class="nochq-dot"></div><div class="nochq-dot"></div></div>';
      msgsContainer.appendChild(msg);
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
      return msg;
    }

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      addMessage('user', text);
      chatHistory.push({ role: 'user', content: text });

      const dots = addDots();

      try {
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            sessionId,
            visitorId,
            sourceUrl: window.location.href,
            messages: chatHistory,
            metadata: {
              browser: navigator.userAgent,
              device: window.innerWidth < 768 ? 'mobile' : 'desktop'
            }
          })
        });

        const data = await res.json();
        dots.remove();

        const botMsg = addMessage('bot', '');
        let i = 0;
        const fullText = data.text || 'Sorry, I am having trouble connecting.';
        
        const interval = setInterval(() => {
          botMsg.innerText = fullText.slice(0, i + 1);
          i++;
          msgsContainer.scrollTop = msgsContainer.scrollHeight;
          if (i >= fullText.length) {
            clearInterval(interval);
            chatHistory.push({ role: 'assistant', content: fullText });
            if (data.conversationId) sessionStorage.setItem('nochq_conv_id', data.conversationId);
          }
        }, 12);

      } catch (e) {
        dots.remove();
        addMessage('bot', 'Network error. Please try again.');
      }
    }

    sendBtn.onclick = sendMessage;
    input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
  }
})();