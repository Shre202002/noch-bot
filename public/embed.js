(function() {
  const scriptTag = document.currentScript;
  const userId = scriptTag.getAttribute('data-user-id');
  const baseUrl = scriptTag.src.replace('/embed.js', '');

  if (!userId) {
    console.error('[NochBot] Missing data-user-id attribute');
    return;
  }

  // --- Session Management ---
  const SESSION_KEY = `nochbot_session_${userId}`;
  const VISITOR_KEY = `nochbot_visitor_${userId}`;

  function getOrCreate(key) {
    let val = localStorage.getItem(key);
    if (!val) {
      val = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem(key, val);
    }
    return val;
  }

  const sessionId = getOrCreate(SESSION_KEY);
  const visitorId = getOrCreate(VISITOR_KEY);

  // --- Styles ---
  const style = document.createElement('style');
  style.innerHTML = `
    #nochbot-widget {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #nochbot-bubble {
      width: 60px; height: 60px; border-radius: 50%;
      background: #36f4a4; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #nochbot-bubble:hover { transform: scale(1.08); }
    #nochbot-window {
      position: absolute; bottom: 80px; right: 0;
      width: 380px; height: 600px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 16px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: none; flex-direction: column;
      transform-origin: bottom right; transition: all 0.3s ease;
    }
    #nochbot-window.open { display: flex; animation: nochbot-fade-in 0.3s ease; }
    @keyframes nochbot-fade-in { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    
    #nochbot-header { padding: 16px; background: #36f4a4; color: #000; display: flex; align-items: center; gap: 12px; }
    #nochbot-messages { flex: 1; overflow-y: auto; padding: 16px; background: #f9fafb; display: flex; flexDirection: column; gap: 12px; }
    .nochbot-msg { max-width: 80%; padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.5; }
    .nochbot-msg-user { align-self: flex-end; background: #36f4a4; color: #000; border-bottom-right-radius: 4px; }
    .nochbot-msg-bot { align-self: flex-start; background: #fff; border: 1px solid #e5e7eb; color: #1f2937; border-bottom-left-radius: 4px; }
    
    #nochbot-input-area { padding: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; background: #fff; }
    #nochbot-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 999px; padding: 8px 16px; outline: none; font-size: 14px; }
    #nochbot-send { background: #36f4a4; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
    #nochbot-send:disabled { opacity: 0.5; }

    @media (max-width: 480px) {
      #nochbot-window { width: calc(100vw - 40px); height: calc(100vh - 100px); bottom: 70px; right: 0; }
    }
  `;
  document.head.appendChild(style);

  // --- HTML Elements ---
  const container = document.createElement('div');
  container.id = 'nochbot-widget';
  container.innerHTML = `
    <div id="nochbot-window">
      <div id="nochbot-header">
        <div style="width:32px; height:32px; border-radius:8px; background:rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; font-size:18px;">🤖</div>
        <div style="font-weight:600; font-size:15px;">Assistant</div>
      </div>
      <div id="nochbot-messages"></div>
      <div id="nochbot-input-area">
        <input type="text" id="nochbot-input" placeholder="Ask a question..." autocomplete="off" />
        <button id="nochbot-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
    <div id="nochbot-bubble">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </div>
  `;
  document.body.appendChild(container);

  // --- Logic ---
  const bubble = document.getElementById('nochbot-bubble');
  const win = document.getElementById('nochbot-window');
  const input = document.getElementById('nochbot-input');
  const sendBtn = document.getElementById('nochbot-send');
  const messagesDiv = document.getElementById('nochbot-messages');

  let config = { botName: 'Assistant', botColor: '#36f4a4' };
  
  // Fetch Bot Config
  fetch(`${baseUrl}/api/knowledge/config?userId=${userId}`)
    .then(r => r.json())
    .then(data => {
      if (data.botName) {
        config.botName = data.botName;
        win.querySelector('#nochbot-header div:last-child').innerText = data.botName;
      }
      if (data.botColor) {
        config.botColor = data.botColor;
        document.getElementById('nochbot-bubble').style.background = data.botColor;
        document.getElementById('nochbot-header').style.background = data.botColor;
        document.getElementById('nochbot-send').style.background = data.botColor;
      }
    }).catch(e => console.warn('[NochBot] Failed to load config', e));

  bubble.onclick = () => win.classList.toggle('open');

  function addMessage(role, content) {
    const m = document.createElement('div');
    m.className = `nochbot-msg nochbot-msg-${role}`;
    m.innerText = content;
    messagesDiv.appendChild(m);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return m;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    addMessage('user', text);

    const typing = addMessage('bot', '...');
    
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          userId: userId,
          sessionId: sessionId,
          visitorId: visitorId,
          sourceUrl: window.location.href,
          metadata: {
            browser: navigator.userAgent,
            device: window.innerWidth < 768 ? 'mobile' : 'desktop'
          }
        })
      });
      const data = await res.json();
      
      typing.remove();
      const botMsg = addMessage('bot', '');
      
      // Typewriter effect
      let i = 0;
      const fullText = data.text || "I'm sorry, I couldn't process that.";
      const interval = setInterval(() => {
        botMsg.innerText = fullText.slice(0, i + 1);
        i++;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        if (i >= fullText.length) clearInterval(interval);
      }, 12);

    } catch (err) {
      typing.innerText = "Connection error. Please try again.";
    }
  }

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => e.key === 'Enter' && sendMessage();

})();