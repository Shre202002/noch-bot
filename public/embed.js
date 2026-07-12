
(function() {
  const scriptTag = document.currentScript;
  const API_BASE = new URL(scriptTag.src).origin;
  const userId = scriptTag.getAttribute('data-user-id');

  if (!userId) {
    console.error('NochBot: Missing data-user-id attribute on script tag.');
    return;
  }

  // Identity Management
  let visitorId = localStorage.getItem('nb_visitor_id');
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem('nb_visitor_id', visitorId);
  }

  let chatSessionId = sessionStorage.getItem('nb_session_id');
  if (!chatSessionId) {
    chatSessionId = crypto.randomUUID();
    sessionStorage.setItem('nb_session_id', chatSessionId);
  }

  const STORAGE_BOOKING_KEY = `nb_booking_${userId}`;

  // State
  const state = {
    isOpen: false,
    messages: [],
    booking: null, // { sessionId, currentStep, eventId, bookingId }
    theme: {
      bubbleColor: '#36f4a4',
      headerColor: '#36f4a4',
      userMsgColor: '#36f4a4',
      sendBtnColor: '#36f4a4',
      accentColor: '#36f4a4'
    }
  };

  // UI Components
  let container, bubble, window, messageArea, input;

  function init() {
    // Inject Styles
    const style = document.createElement('style');
    style.textContent = `
      #nb-container { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: system-ui, -apple-system, sans-serif; }
      #nb-bubble { width: 60px; height: 60px; border-radius: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.2s; }
      #nb-bubble:hover { transform: scale(1.05); }
      #nb-bubble svg { width: 28px; height: 28px; color: white; }
      #nb-window { position: absolute; bottom: 80px; right: 0; width: 380px; height: 600px; max-height: calc(100vh - 120px); background: #f9fafb; border-radius: 20px; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05); }
      #nb-window.open { display: flex; animation: nb-slide 0.3s ease-out; }
      @keyframes nb-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      #nb-header { padding: 20px; color: white; display: flex; align-items: center; justify-content: space-between; }
      #nb-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
      #nb-header span { font-size: 11px; opacity: 0.8; }
      #nb-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
      .nb-msg { max-width: 80%; padding: 10px 14px; font-size: 14px; line-height: 1.5; border-radius: 18px; position: relative; }
      .nb-msg-bot { background: white; color: #1f2937; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #f3f4f6; }
      .nb-msg-user { color: black; align-self: flex-end; border-bottom-right-radius: 4px; }
      #nb-footer { padding: 16px; background: white; border-top: 1px solid #f3f4f6; display: flex; gap: 10px; }
      #nb-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 24px; padding: 10px 16px; font-size: 14px; outline: none; }
      #nb-send { width: 40px; height: 40px; border-radius: 20px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      #nb-send svg { width: 18px; height: 18px; color: white; }
      .nb-ticket-card { background: #111; color: white; padding: 20px; border-radius: 16px; margin-top: 10px; border: 1px solid #333; }
      .nb-ticket-card a { display: block; background: #36f4a4; color: black; text-align: center; padding: 10px; border-radius: 8px; margin-top: 15px; font-weight: 700; text-decoration: none; }
      .nb-typing { display: flex; gap: 4px; padding: 12px 16px; background: white; border-radius: 18px; align-self: flex-start; border: 1px solid #f3f4f6; }
      .nb-dot { width: 6px; height: 6px; background: #d1d5db; border-radius: 50%; animation: nb-bounce 1.4s infinite; }
      @keyframes nb-bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
    `;
    document.head.appendChild(style);

    container = document.createElement('div');
    container.id = 'nb-container';
    document.body.appendChild(container);

    bubble = document.createElement('div');
    bubble.id = 'nb-bubble';
    bubble.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>`;
    bubble.onclick = toggleWindow;
    container.appendChild(bubble);

    window = document.createElement('div');
    window.id = 'nb-window';
    window.innerHTML = `
      <div id="nb-header">
        <div>
          <h3>AI Assistant</h3>
          <span>● Online</span>
        </div>
        <div style="cursor:pointer" id="nb-close">✕</div>
      </div>
      <div id="nb-messages"></div>
      <div id="nb-footer">
        <input type="text" id="nb-input" placeholder="Type a message...">
        <button id="nb-send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" stroke="none"/></svg></button>
      </div>
    `;
    container.appendChild(window);

    messageArea = window.querySelector('#nb-messages');
    input = window.querySelector('#nb-input');
    const sendBtn = window.querySelector('#nb-send');
    const closeBtn = window.querySelector('#nb-close');

    sendBtn.onclick = handleSend;
    closeBtn.onclick = toggleWindow;
    input.onkeypress = (e) => { if (e.key === 'Enter') handleSend(); };

    fetchTheme();
    checkBookingResume();
  }

  function toggleWindow() {
    state.isOpen = !state.isOpen;
    window.classList.toggle('open', state.isOpen);
    if (state.isOpen && state.messages.length === 0) {
      addMessage('assistant', "Hello! How can I help you today?");
    }
  }

  async function fetchTheme() {
    try {
      const res = await fetch(`${API_BASE}/api/theme?userId=${userId}`);
      const data = await res.json();
      if (data.theme) {
        state.theme = { ...state.theme, ...data.theme };
        applyTheme();
      }
    } catch (e) {}
  }

  function applyTheme() {
    bubble.style.backgroundColor = state.theme.bubbleColor;
    window.querySelector('#nb-header').style.backgroundColor = state.theme.headerColor;
    window.querySelector('#nb-send').style.backgroundColor = state.theme.sendBtnColor;
  }

  function addMessage(role, content) {
    state.messages.push({ role, content });
    renderMessages();
  }

  function renderMessages() {
    messageArea.innerHTML = '';
    state.messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = `nb-msg nb-msg-${msg.role === 'assistant' ? 'bot' : 'user'}`;
      if (msg.role === 'user') div.style.backgroundColor = state.theme.userMsgColor;
      div.textContent = msg.content;
      messageArea.appendChild(div);
    });
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    if (state.booking) {
      handleBookingChat(text);
    } else {
      handleStandardChat(text);
    }
  }

  async function handleStandardChat(text) {
    addMessage('user', text);
    
    // Add typing indicator
    const typing = document.createElement('div');
    typing.className = 'nb-typing';
    typing.innerHTML = '<div class="nb-dot"></div><div class="nb-dot"></div><div class="nb-dot"></div>';
    messageArea.appendChild(typing);
    messageArea.scrollTop = messageArea.scrollHeight;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId: chatSessionId,
          visitorId,
          messages: state.messages.map(m => ({
            role: m.role === "bot" ? "assistant" : m.role,
            content: m.content
          })),
          sourceUrl: window.location.href
        })
      });

      const data = await res.json();
      typing.remove();

      if (data.text) {
        addMessage('assistant', data.text);
      }

      if (data.action && data.action.type === 'START_BOOKING') {
        startBookingFlow();
      }
    } catch (e) {
      typing.remove();
      addMessage('assistant', "I'm having trouble connecting right now. Please try again later.");
    }
  }

  async function startBookingFlow(eventId = null) {
    addMessage('assistant', "I'll help you with your booking. Just a moment...");
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, visitorId, chatSessionId, eventId })
      });
      const data = await res.json();
      state.booking = { sessionId: data.session_id, currentStep: data.current_step, eventId: data.event_id };
      saveBookingState();
      processBookingStep(data);
    } catch (e) {}
  }

  function saveBookingState() {
    localStorage.setItem(STORAGE_BOOKING_KEY, JSON.stringify(state.booking));
  }

  async function checkBookingResume() {
    const saved = localStorage.getItem(STORAGE_BOOKING_KEY);
    if (!saved) return;
    try {
      const booking = JSON.parse(saved);
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${booking.sessionId}?userId=${userId}&visitorId=${visitorId}`);
      if (!res.ok) {
        localStorage.removeItem(STORAGE_BOOKING_KEY);
        return;
      }
      const data = await res.json();
      state.booking = { ...booking, currentStep: data.current_step };

      // If already complete, show status
      if (data.status === 'complete' || data.status === 'confirmed' || data.status === 'checkout_pending') {
        checkStatus(booking.sessionId);
      }
    } catch (e) {}
  }

  async function handleBookingChat(text) {
    addMessage('user', text);
    try {
      const step = state.booking.currentStep;
      let action = 'answer_field';
      let payload = { value: text };

      if (step === 'quantity') {
        action = 'set_quantity';
        payload = { quantity: text };
      } else if (step === 'select_event') {
        action = 'select_event';
        payload = { eventId: text };
      } else if (step === 'summary') {
        confirmBooking();
        return;
      }

      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${state.booking.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload, userId, visitorId })
      });
      const data = await res.json();
      state.booking.currentStep = data.current_step;
      saveBookingState();
      processBookingStep(data);
    } catch (e) {}
  }

  async function confirmBooking() {
    addMessage('assistant', "Finalizing your booking...");
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${state.booking.sessionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, visitorId })
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        addMessage('assistant', "Ready! Please complete the payment to receive your ticket.");
        renderPaymentCard(data.checkoutUrl);
      } else {
        addMessage('assistant', "Success! Your booking is confirmed.");
        renderTicketCard(data);
      }
    } catch (e) {}
  }

  function processBookingStep(data) {
    if (data.current_step === 'quantity') {
      addMessage('assistant', "How many tickets would you like?");
    } else if (data.current_step === 'collect_field') {
      // Find current field label
      addMessage('assistant', `Please provide your details.`);
    } else if (data.current_step === 'summary') {
      addMessage('assistant', "Does everything look correct? Type 'Confirm' to proceed.");
    }
  }

  function renderPaymentCard(url) {
    const div = document.createElement('div');
    div.className = 'nb-msg nb-msg-bot';
    div.innerHTML = `
      <div class="nb-ticket-card">
        <p>Complete Payment</p>
        <a href="${url}" target="_blank">Pay Now</a>
      </div>
    `;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function renderTicketCard(result) {
    const div = document.createElement('div');
    div.className = 'nb-msg nb-msg-bot';
    const ticketUrl = `${API_BASE}/booking/ticket/${result.booking_id}?userId=${userId}&visitorId=${visitorId}`;
    div.innerHTML = `
      <div class="nb-ticket-card">
        <p>Booking Confirmed!</p>
        <p style="font-size:12px;opacity:0.7">Code: ${result.booking_code || '---'}</p>
        <a href="${ticketUrl}" target="_blank">Download Ticket</a>
      </div>
    `;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  async function checkStatus(sessionId) {
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${sessionId}?userId=${userId}&visitorId=${visitorId}`);
      const data = await res.json();
      if (data.booking_id) {
        const statusRes = await fetch(`${API_BASE}/api/embed/bookings/${data.booking_id}/status?userId=${userId}&visitorId=${visitorId}`);
        const status = await statusRes.json();
        renderTicketCard({ ...status, booking_id: data.booking_id });
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
