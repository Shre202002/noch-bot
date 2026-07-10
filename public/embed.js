(function() {
  const script = document.currentScript;
  const userId = script.getAttribute('data-user-id');
  if (!userId) return;

  const API_BASE = window.location.origin;
  const BOOKING_KEY = "nb_booking_" + userId;

  const state = {
    isOpen: false,
    messages: [],
    events: [],
    bookingPriorityMode: false,
    activeBooking: null,
    currentStep: 'chat',
    sessionId: localStorage.getItem('nb_session_' + userId) || 's_' + Math.random().toString(36).slice(2),
    visitorId: localStorage.getItem('nb_visitor_' + userId) || 'v_' + Math.random().toString(36).slice(2),
  };

  localStorage.setItem('nb_session_' + userId, state.sessionId);
  localStorage.setItem('nb_visitor_' + userId, state.visitorId);

  // --- UI Creation ---

  const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      #nb-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: #000; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 999999; transition: transform 0.2s; }
      #nb-bubble:hover { transform: scale(1.05); }
      #nb-window { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 600px; background: #fff; border-radius: 20px; border: 1px solid #eee; display: none; flex-direction: column; overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,0.15); z-index: 999999; font-family: system-ui, -apple-system, sans-serif; }
      #nb-header { background: #000; color: #fff; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
      #nb-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; }
      .nb-msg { max-width: 85%; padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.5; }
      .nb-bot { background: #fff; border: 1px solid #eee; align-self: flex-start; border-bottom-left-radius: 4px; color: #111; }
      .nb-user { background: #000; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
      #nb-input-area { padding: 16px; border-top: 1px solid #eee; display: flex; gap: 8px; }
      #nb-input { flex: 1; border: 1px solid #ddd; border-radius: 24px; padding: 8px 16px; outline: none; font-size: 14px; }
      .nb-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 16px; margin-top: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
      .nb-btn { display: block; width: 100%; padding: 10px; background: #000; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 10px; text-align: center; text-decoration: none; font-size: 13px; }
      .nb-btn-outline { background: #fff; color: #000; border: 1px solid #000; }
      .nb-btn:hover { opacity: 0.9; }
      @media (max-width: 480px) { #nb-window { width: calc(100% - 40px); height: calc(100% - 110px); } }
    `;
    document.head.appendChild(style);
  };

  const initUI = () => {
    const bubble = document.createElement('div');
    bubble.id = 'nb-bubble';
    bubble.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    document.body.appendChild(bubble);

    const chatWindow = document.createElement('div');
    chatWindow.id = 'nb-window';
    chatWindow.innerHTML = `
      <div id="nb-header">
        <div style="font-weight:700">AI Assistant</div>
        <div id="nb-close" style="cursor:pointer">&times;</div>
      </div>
      <div id="nb-messages"></div>
      <div id="nb-input-area">
        <input id="nb-input" placeholder="Type a message..." autocomplete="off">
      </div>
    `;
    document.body.appendChild(chatWindow);

    bubble.onclick = () => {
      state.isOpen = !state.isOpen;
      chatWindow.style.display = state.isOpen ? 'flex' : 'none';
      if (state.isOpen && state.messages.length === 0) startConversation();
    };

    document.getElementById('nb-close').onclick = () => {
      state.isOpen = false;
      chatWindow.style.display = 'none';
    };

    const input = document.getElementById('nb-input');
    input.onkeydown = (e) => {
      if (e.key === 'Enter') handleSend();
    };
  };

  // --- Logic ---

  const handleSend = async () => {
    const input = document.getElementById('nb-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    appendMessage('user', text);

    if (state.currentStep === 'booking') {
      processBookingStep(text);
      return;
    }

    // Detect intent for booking
    const bookingTriggers = ["book", "ticket", "register", "attend", "join"];
    if (bookingTriggers.some(k => text.toLowerCase().includes(k)) && state.events.length > 0) {
      startBookingFlow();
      return;
    }

    // Normal Q&A
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.messages.map(m => ({ role: m.role, content: m.content })),
          userId,
          sessionId: state.sessionId,
          visitorId: state.visitorId,
          sourceUrl: window.location.href
        })
      });
      const data = await res.json();
      
      appendMessage('bot', data.text || "I'm not sure about that.");

      if (data.action?.type === 'START_BOOKING') {
        startBookingFlow();
      } else if (state.bookingPriorityMode) {
        appendBotMessage("By the way, tickets are available for our upcoming events! Would you like to book one?", [
          { label: "Yes, book now", action: startBookingFlow },
          { label: "No thanks", action: null }
        ]);
      }
    } catch (e) {
      appendMessage('bot', "Sorry, I'm having trouble connecting right now.");
    }
  };

  const startConversation = () => {
    const saved = localStorage.getItem(BOOKING_KEY);
    if (saved) {
      const b = JSON.parse(saved);
      if (Date.now() - b.updatedAt < 30 * 60000) {
        resumeBooking(b.bookingId);
        return;
      }
    }

    if (state.bookingPriorityMode && state.events.length > 0) {
      appendMessage('bot', `Hello! Tickets are available for **${state.events[0].name}**. Would you like to book yours now?`);
      renderEventCard(state.events[0]);
    } else {
      appendMessage('bot', "Hello! How can I help you today?");
    }
  };

  const startBookingFlow = async (eventId) => {
    state.currentStep = 'booking';
    const ev = eventId ? state.events.find(e => e.id === eventId) : state.events[0];
    
    appendMessage('bot', `Great! Let's get you registered for **${ev.name}**.`);
    
    const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventId: ev.id, visitorId: state.visitorId })
    });
    const session = await res.json();
    state.activeBooking = session;
    
    askNextBookingField();
  };

  const askNextBookingField = async () => {
    const session = state.activeBooking;
    const { event, fields } = await (await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`)).json();
    
    if (session.current_step === 'quantity') {
      appendBotMessage("How many tickets would you like to book?");
      return;
    }

    if (session.current_step === 'collect_field') {
      const field = fields[session.current_field_index];
      appendBotMessage(`Please provide your **${field.label}**:`);
      return;
    }

    if (session.current_step === 'summary') {
      renderSummaryCard(event, session);
      return;
    }
  };

  const processBookingStep = async (value) => {
    const session = state.activeBooking;
    let payload = {};

    if (session.current_step === 'quantity') {
      payload = { action: 'set_quantity', quantity: parseInt(value) || 1 };
    } else if (session.current_step === 'collect_field') {
      const { fields } = await (await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`)).json();
      const field = fields[session.current_field_index];
      payload = { action: 'answer_field', fieldId: field.id, value };
    }

    const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const err = await res.json();
      appendMessage('bot', "⚠️ " + (err.error || "Invalid input, please try again."));
      return;
    }

    state.activeBooking = await res.json();
    askNextBookingField();
  };

  const renderSummaryCard = (event, session) => {
    const total = event.is_paid ? (event.price * session.quantity).toFixed(2) : 0;
    const card = document.createElement('div');
    card.className = 'nb-card';
    card.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px">Booking Summary</div>
      <div style="font-size:12px;color:#666">Event: ${event.name}</div>
      <div style="font-size:12px;color:#666">Quantity: ${session.quantity}</div>
      <div style="font-size:12px;color:#666;margin-bottom:12px">Total: ${event.currency || 'USD'} ${total}</div>
      <button class="nb-btn" id="nb-confirm-btn">Confirm Booking</button>
    `;
    document.getElementById('nb-messages').appendChild(card);
    
    document.getElementById('nb-confirm-btn').onclick = async () => {
      document.getElementById('nb-confirm-btn').disabled = true;
      document.getElementById('nb-confirm-btn').innerText = "Processing...";
      
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, visitorId: state.visitorId })
      });
      
      const result = await res.json();
      if (result.status === 'confirmed') {
        appendBotMessage("Booking confirmed! Your code is: **" + result.booking_code + "**");
        const btn = document.createElement('a');
        btn.className = 'nb-btn';
        btn.href = API_BASE + result.download_url;
        btn.target = "_blank";
        btn.innerText = "Download Ticket";
        document.getElementById('nb-messages').appendChild(btn);
        localStorage.removeItem(BOOKING_KEY);
      } else if (result.status === 'checkout_pending') {
        appendBotMessage("Redirecting to secure payment...");
        localStorage.setItem(BOOKING_KEY, JSON.stringify({
          sessionId: state.sessionId,
          bookingId: result.booking_id,
          eventId: event.id,
          status: "checkout_pending",
          updatedAt: Date.now()
        }));
        setTimeout(() => { globalThis.location.href = result.checkoutUrl; }, 1500);
      }
    };
  };

  const resumeBooking = async (bookingId) => {
    const res = await fetch(`${API_BASE}/api/embed/bookings/${bookingId}/status?userId=${userId}&visitorId=${state.visitorId}`);
    const b = await res.json();
    
    if (b.status === 'confirmed') {
      appendBotMessage("Welcome back! Your booking is confirmed.");
      const btn = document.createElement('a');
      btn.className = 'nb-btn';
      btn.href = API_BASE + b.download_url;
      btn.target = "_blank";
      btn.innerText = "Download Ticket";
      document.getElementById('nb-messages').appendChild(btn);
    } else if (b.status === 'pending_payment') {
      appendBotMessage("Your payment for the booking is still pending. Please complete it to receive your ticket.");
    } else {
      localStorage.removeItem(BOOKING_KEY);
      startConversation();
    }
  };

  const appendMessage = (role, content) => {
    state.messages.push({ role, content });
    const div = document.createElement('div');
    div.className = `nb-msg nb-${role}`;
    div.innerText = content;
    const container = document.getElementById('nb-messages');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  };

  const appendBotMessage = (text, buttons = []) => {
    appendMessage('bot', text);
    if (buttons.length > 0) {
      const area = document.createElement('div');
      area.style.display = 'flex';
      area.style.gap = '8px';
      buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'nb-btn nb-btn-outline';
        btn.innerText = b.label;
        btn.onclick = () => { if (b.action) b.action(); };
        area.appendChild(btn);
      });
      document.getElementById('nb-messages').appendChild(area);
    }
  };

  const renderEventCard = (event) => {
    const card = document.createElement('div');
    card.className = 'nb-card';
    card.innerHTML = `
      <div style="font-weight:700">${event.name}</div>
      <div style="font-size:12px;color:#666;margin:4px 0">${event.venue || 'Online'}</div>
      <div style="font-size:13px;font-weight:600">${event.is_paid ? event.currency + ' ' + event.price : 'Free'}</div>
      <button class="nb-btn" id="book-btn-${event.id}">Book Ticket</button>
    `;
    document.getElementById('nb-messages').appendChild(card);
    document.getElementById(`book-btn-${event.id}`).onclick = () => startBookingFlow(event.id);
  };

  // --- Startup ---

  fetch(`${API_BASE}/api/embed/events?userId=${userId}`)
    .then(r => r.json())
    .then(data => {
      state.events = data.events || [];
      if (state.events.length > 0) state.bookingPriorityMode = true;
      injectStyles();
      initUI();
    });

})();
