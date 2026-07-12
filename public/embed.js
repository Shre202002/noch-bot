(function() {
  // Use unique keys per userId to avoid conflicts between different NochBot accounts on same domain
  const script = document.currentScript;
  const userId = script.getAttribute('data-user-id');
  if (!userId) return console.error('NochBot: Missing data-user-id');

  const API_BASE = new URL(script.src).origin;
  const VISITOR_KEY = "nb_visitor_" + userId;
  const SESSION_KEY = "nb_session_" + userId;
  const BOOKING_KEY = "nb_booking_" + userId;

  const state = {
    isOpen: false,
    messages: [],
    events: [],
    loading: false,
    botName: "Assistant",
    botColor: "#6366f1",
    botIcon: "",
    userId: userId,
    visitorId: localStorage.getItem(VISITOR_KEY) || null,
    chatSessionId: sessionStorage.getItem(SESSION_KEY) || null,
    activeBookingSession: null,
    bookingPriorityMode: false,
    eventFields: {} // Cache for form fields
  };

  // ── Initialization ─────────────────────────────────────────────────────────
  if (!state.visitorId) {
    state.visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, state.visitorId);
  }
  if (!state.chatSessionId) {
    state.chatSessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, state.chatSessionId);
  }

  const corsHeaders = {
    'Content-Type': 'application/json'
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Fetch bot config & active events
  async function init() {
    try {
      const [configRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/knowledge/config?userId=${userId}`),
        fetch(`${API_BASE}/api/embed/events?userId=${userId}`)
      ]);

      if (configRes.ok) {
        const config = await configRes.json();
        if (config.botName) state.botName = config.botName;
        if (config.botColor) state.botColor = config.botColor;
        if (config.botIcon) state.botIcon = config.botIcon;
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        state.events = eventsData.events || [];
        state.bookingPriorityMode = state.events.length > 0;
      }
      
      render();
      if (state.bookingPriorityMode) {
        // Only trigger booking-centric greeting if no normal chat has started
        if (state.messages.length === 0) {
          sendBotGreeting();
        }
      }
      
      checkBookingResume();
    } catch (err) {
      console.warn('NochBot: Startup failed', err);
      // Fallback: render UI anyway for basic Q&A
      state.bookingPriorityMode = false;
      render();
    }
  }

  async function checkBookingResume() {
    const stored = localStorage.getItem(BOOKING_KEY);
    if (!stored) return;

    try {
      const booking = JSON.parse(stored);
      if (booking.bookingId) {
        const res = await fetch(`${API_BASE}/api/embed/bookings/${booking.bookingId}/status?userId=${userId}&visitorId=${state.visitorId}`);
        if (!res.ok) return;
        const statusData = await res.json();
        
        if (statusData.status === "confirmed" && statusData.can_download_ticket) {
          addMessage("bot", `Great news! Your booking **${statusData.booking_code}** is confirmed. You can view your tickets below.`);
          renderTicketCard(statusData);
          localStorage.removeItem(BOOKING_KEY);
        } else if (statusData.status === "pending_payment") {
          // Already handled by initial greeting or persistent session check
        } else if (["expired", "failed", "cancelled"].includes(statusData.status)) {
          localStorage.removeItem(BOOKING_KEY);
        }
      }
    } catch (e) {}
  }

  function sendBotGreeting() {
    if (state.events.length === 1) {
      const e = state.events[0];
      addMessage("bot", `Hello! I'm ${state.botName}. Would you like to book tickets for **${escapeHtml(e.name)}**?`);
      renderEventCard(e);
    } else {
      addMessage("bot", `Hello! I'm ${state.botName}. We have ${state.events.length} active events. Which one would you like to attend?`);
      renderEventList(state.events);
    }
  }

  // ── UI Components ──────────────────────────────────────────────────────────
  const styles = `
    #nb-widget { font-family: system-ui, -apple-system, sans-serif; position: fixed; bottom: 24px; right: 24px; z-index: 999999; display: flex; flex-direction: column; align-items: flex-end; }
    #nb-bubble { width: 56px; height: 56px; border-radius: 50%; display: flex; items-center; justify-content: center; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    #nb-bubble:hover { transform: scale(1.08); }
    #nb-bubble svg { width: 24px; height: 24px; color: white; }
    #nb-window { width: 360px; height: 600px; max-height: 80vh; background: #fff; border-radius: 20px; box-shadow: 0 12px 40px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; margin-bottom: 16px; border: 1px solid #f1f1f1; }
    #nb-header { padding: 16px 20px; color: white; display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 600; }
    #nb-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; scroll-behavior: smooth; }
    .nb-msg { max-width: 80%; padding: 10px 14px; border-radius: 18px; font-size: 13.5px; line-height: 1.5; word-wrap: break-word; }
    .nb-msg-bot { background: #fff; color: #1f2937; align-self: flex-start; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #f1f1f1; }
    .nb-msg-user { background: var(--nb-color); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    #nb-input-area { padding: 16px; background: #fff; border-top: 1px solid #f1f1f1; display: flex; gap: 10px; }
    #nb-input { flex: 1; border: 1.5px solid #e5e7eb; border-radius: 24px; padding: 8px 16px; font-size: 13.5px; outline: none; transition: border-color 0.2s; }
    #nb-input:focus { border-color: var(--nb-color); }
    #nb-send { background: var(--nb-color); border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; display: flex; items-center; justify-content: center; color: white; transition: opacity 0.2s; }
    #nb-send:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .nb-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-top: 8px; width: 100%; box-sizing: border-box; }
    .nb-btn { width: 100%; background: var(--nb-color); color: white; border: none; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 12px; transition: opacity 0.2s; }
    .nb-btn-outline { background: transparent; border: 1px solid var(--nb-color); color: var(--nb-color); }
    .nb-event-item { padding: 12px; border: 1px solid #f1f1f1; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s; }
    .nb-event-item:hover { background: #f9fafb; border-color: var(--nb-color); }
    .nb-event-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .nb-event-meta { font-size: 11px; color: #6b7280; display: flex; gap: 8px; }
    
    .nb-summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #f1f1f1; }
    .nb-summary-label { color: #6b7280; font-weight: 500; }
    .nb-summary-val { font-weight: 600; color: #1f2937; }
    
    @keyframes nb-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .nb-animate { animation: nb-fade-in 0.3s ease forwards; }
  `;

  function render() {
    let widget = document.getElementById('nb-widget');
    if (!widget) {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = styles;
      document.head.appendChild(styleEl);

      widget = document.createElement('div');
      widget.id = 'nb-widget';
      widget.innerHTML = `
        <div id="nb-window">
          <div id="nb-header" style="background: ${state.botColor}">
            <div id="nb-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; font-size: 16px; overflow: hidden">
              ${state.botIcon ? `<img src="${state.botIcon}" style="width:100%;height:100%;object-fit:cover">` : '🤖'}
            </div>
            <div>
              <div id="nb-bot-name">${escapeHtml(state.botName)}</div>
              <div style="font-size: 10px; opacity: 0.8">● Online</div>
            </div>
          </div>
          <div id="nb-messages"></div>
          <div id="nb-input-area">
            <input id="nb-input" type="text" placeholder="Type a message...">
            <button id="nb-send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
        <div id="nb-bubble" style="background: ${state.botColor}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </div>
      `;
      document.body.appendChild(widget);

      const bubble = document.getElementById('nb-bubble');
      const win = document.getElementById('nb-window');
      bubble.addEventListener('click', () => {
        state.isOpen = !state.isOpen;
        win.style.display = state.isOpen ? 'flex' : 'none';
        if (state.isOpen) setTimeout(() => document.getElementById('nb-input').focus(), 100);
      });

      const input = document.getElementById('nb-input');
      const send = document.getElementById('nb-send');
      
      const handleSend = () => {
        const text = input.value.trim();
        if (!text || state.loading) return;
        handleUserMessage(text);
        input.value = '';
      };

      send.addEventListener('click', handleSend);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
      });
    }

    // Update colors
    document.documentElement.style.setProperty('--nb-color', state.botColor);
  }

  function addMessage(role, content) {
    state.messages.push({ role, content });
    const container = document.getElementById('nb-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `nb-msg nb-msg-${role} nb-animate`;
    div.innerText = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderEventList(events) {
    const container = document.getElementById('nb-messages');
    const list = document.createElement('div');
    list.className = 'nb-card nb-animate';
    list.innerHTML = `<p style="font-size: 12px; color: #6b7280; font-weight: 600; margin-bottom: 12px; text-transform: uppercase;">Active Events</p>`;
    
    events.forEach(e => {
      const item = document.createElement('div');
      item.className = 'nb-event-item';
      item.innerHTML = `
        <div class="nb-event-name">${escapeHtml(e.name)}</div>
        <div class="nb-event-meta">
          <span>📅 ${new Date(e.date).toLocaleDateString()}</span>
          <span>📍 ${escapeHtml(e.venue || 'TBA')}</span>
        </div>
      `;
      item.onclick = () => selectEvent(e.id);
      list.appendChild(item);
    });
    
    container.appendChild(list);
    container.scrollTop = container.scrollHeight;
  }

  function renderEventCard(e) {
    const container = document.getElementById('nb-messages');
    const card = document.createElement('div');
    card.className = 'nb-card nb-animate';
    card.innerHTML = `
      <div class="nb-event-name">${escapeHtml(e.name)}</div>
      <p style="font-size: 12px; color: #6b7280; margin: 8px 0;">${escapeHtml(e.description)}</p>
      <div class="nb-event-meta" style="margin-bottom: 12px;">
        <span>📍 ${escapeHtml(e.venue || 'TBA')}</span>
        <span>🎟️ ${e.is_paid ? e.currency + ' ' + e.price : 'FREE'}</span>
      </div>
      <button class="nb-btn">Start Booking</button>
    `;
    card.querySelector('button').onclick = () => selectEvent(e.id);
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  async function selectEvent(id) {
    if (state.loading) return;
    state.loading = true;
    
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
        method: "POST",
        headers: corsHeaders,
        body: JSON.stringify({
          userId,
          visitorId: state.visitorId,
          chatSessionId: state.chatSessionId,
          eventId: id
        })
      });
      
      const session = await res.json();
      state.activeBookingSession = session;
      renderCurrentSessionStep();
    } catch (e) {
      addMessage("bot", "I'm sorry, I couldn't start the booking session. Please try again.");
    } finally {
      state.loading = false;
    }
  }

  async function handleUserMessage(text) {
    addMessage("user", text);
    
    if (state.activeBookingSession && !['complete', 'payment'].includes(state.activeBookingSession.current_step)) {
      handleBookingAnswer(text);
    } else {
      // Normal Q&A
      state.loading = true;
      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: corsHeaders,
          body: JSON.stringify({
            userId,
            visitorId: state.visitorId,
            sessionId: state.chatSessionId,
            sourceUrl: globalThis.location.href,
            messages: state.messages.map(m => ({
              role: m.role === "bot" ? "assistant" : m.role,
              content: m.content
            }))
          })
        });
        const data = await res.json();
        
        if (data.action?.type === "START_BOOKING" && state.events.length > 0) {
          addMessage("bot", data.text);
          if (state.events.length === 1) selectEvent(state.events[0].id);
          else renderEventList(state.events);
        } else {
          addMessage("bot", data.text || "I'm sorry, I couldn't process that.");
        }
      } catch (err) {
        addMessage("bot", "⚠️ Network error. Please try again.");
      } finally {
        state.loading = false;
      }
    }
  }

  async function handleBookingAnswer(text) {
    if (state.loading) return;
    state.loading = true;
    
    const session = state.activeBookingSession;
    let action = "";
    let body = { userId, visitorId: state.visitorId };

    if (session.current_step === "quantity") {
      action = "set_quantity";
      body.quantity = text;
    } else if (session.current_step === "collect_field") {
      action = "answer_field";
      // Find the ID of the field we are currently answering
      const fieldsRes = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
      const fieldsData = await fieldsRes.json();
      const currentField = fieldsData.fields[session.current_field_index];
      body.fieldId = currentField.id;
      body.value = text;
    }

    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}`, {
        method: "PATCH",
        headers: corsHeaders,
        body: JSON.stringify({ ...body, action })
      });
      
      const updated = await res.json();
      if (!res.ok) {
        addMessage("bot", updated.error || "That input doesn't look right. Could you try again?");
        state.loading = false;
        return;
      }
      
      state.activeBookingSession = updated;
      renderCurrentSessionStep();
    } catch (e) {
      addMessage("bot", "I'm having trouble connecting. Please try again.");
    } finally {
      state.loading = false;
    }
  }

  async function renderCurrentSessionStep() {
    const session = state.activeBookingSession;
    const container = document.getElementById('nb-messages');

    if (session.current_step === "quantity") {
      addMessage("bot", "How many tickets would you like to book?");
    } else if (session.current_step === "collect_field") {
      const res = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
      const data = await res.json();
      const field = data.fields[session.current_field_index];
      const attendeeSuffix = session.quantity > 1 ? ` for attendee #${Math.floor(session.answers.length / data.fields.length) + 1}` : '';
      addMessage("bot", `Please provide the ${field.label}${attendeeSuffix}:`);
    } else if (session.current_step === "summary") {
      addMessage("bot", "Perfect. Here is a summary of your booking. Please confirm to proceed.");
      renderSummaryCard(session);
    } else if (session.current_step === "payment") {
      addMessage("bot", "Your booking is held! Please complete the payment to secure your tickets.");
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}?userId=${userId}&visitorId=${state.visitorId}`);
      const s = await res.json();
      if (s.checkout_url) {
        const card = document.createElement('div');
        card.className = 'nb-card nb-animate';
        card.innerHTML = `<button class="nb-btn">Complete Payment</button>`;
        card.querySelector('button').onclick = () => globalThis.location.href = s.checkout_url;
        container.appendChild(card);
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  async function renderSummaryCard(session) {
    const container = document.getElementById('nb-messages');
    const card = document.createElement('div');
    card.className = 'nb-card nb-animate';
    
    // Fetch event snapshot for price
    const res = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
    const data = await res.json();
    const e = data.event;
    const total = e.is_paid ? e.price * session.quantity : 0;

    let html = `
      <p style="font-weight: 700; margin-bottom: 12px; font-size: 14px;">Booking Summary</p>
      <div class="nb-summary-row"><span class="nb-summary-label">Event</span><span class="nb-summary-val">${escapeHtml(e.name)}</span></div>
      <div class="nb-summary-row"><span class="nb-summary-label">Quantity</span><span class="nb-summary-val">${session.quantity}</span></div>
    `;
    
    session.answers.forEach(a => {
      html += `<div class="nb-summary-row"><span class="nb-summary-label">${escapeHtml(a.label)}</span><span class="nb-summary-val">${escapeHtml(a.value)}</span></div>`;
    });

    if (e.is_paid) {
      html += `<div class="nb-summary-row" style="border:none; margin-top: 4px;"><span class="nb-summary-label" style="color:#1f2937">Total Amount</span><span class="nb-summary-val" style="color:var(--nb-color)">${e.currency} ${total.toFixed(2)}</span></div>`;
    }

    html += `<button class="nb-btn">Confirm Booking</button>`;
    card.innerHTML = html;
    card.querySelector('button').onclick = () => confirmBooking();
    
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  async function confirmBooking() {
    if (state.loading) return;
    state.loading = true;
    const session = state.activeBookingSession;

    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}/confirm`, {
        method: "POST",
        headers: corsHeaders,
        body: JSON.stringify({ userId, visitorId: state.visitorId })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (result.status === "confirmed") {
        addMessage("bot", `Perfect! Your booking is confirmed. Your code is **${result.booking_code}**.`);
        renderTicketCard(result);
        localStorage.removeItem(BOOKING_KEY);
      } else if (result.status === "checkout_pending") {
        localStorage.setItem(BOOKING_KEY, JSON.stringify({
          sessionId: session.session_id,
          bookingId: result.booking_id,
          eventId: session.event_id,
          status: "checkout_pending",
          updatedAt: Date.now()
        }));
        globalThis.location.href = result.checkoutUrl;
      }
    } catch (err) {
      addMessage("bot", "Booking failed: " + err.message);
    } finally {
      state.loading = false;
    }
  }

  function renderTicketCard(result) {
    const container = document.getElementById('nb-messages');
    const card = document.createElement('div');
    card.className = 'nb-card nb-animate';
    const downloadUrl = `${API_BASE}/booking/ticket/${result.booking_id}?userId=${userId}&visitorId=${state.visitorId}`;
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <div style="background: #36f4a420; color: #36f4a4; padding: 6px; border-radius: 8px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3"/></svg></div>
        <div>
          <p style="font-size: 13px; font-weight: 700; color: #1f2937">Ticket Ready</p>
          <p style="font-size: 11px; color: #6b7280">${result.booking_code}</p>
        </div>
      </div>
      <a href="${downloadUrl}" target="_blank" class="nb-btn" style="text-decoration: none; display: block; text-align: center;">View Ticket</a>
    `;
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
