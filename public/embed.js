(function() {
  const script = document.currentScript;
  const userId = script.getAttribute("data-user-id");
  if (!userId) return;

  const API_BASE = new URL(script.src).origin;
  const VISITOR_KEY = "nb_visitor_" + userId;
  const SESSION_KEY = "nb_session_" + userId;
  const BOOKING_KEY = "nb_booking_" + userId;

  const state = {
    open: false,
    messages: [],
    loading: false,
    events: [],
    bookingPriorityMode: false,
    visitorId: localStorage.getItem(VISITOR_KEY) || crypto.randomUUID(),
    chatSessionId: sessionStorage.getItem(SESSION_KEY) || crypto.randomUUID(),
    activeBookingSession: null,
    theme: {
      bubbleColor: "#36f4a4",
      headerColor: "#36f4a4",
      userMsgColor: "#36f4a4",
      sendBtnColor: "#36f4a4",
      accentColor: "#36f4a4"
    }
  };

  localStorage.setItem(VISITOR_KEY, state.visitorId);
  sessionStorage.setItem(SESSION_KEY, state.chatSessionId);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function init() {
    try {
      const [eventsRes, themeRes] = await Promise.all([
        fetch(`${API_BASE}/api/embed/events?userId=${userId}`),
        fetch(`${API_BASE}/api/theme?userId=${userId}`)
      ]);

      const eventsData = await eventsRes.json();
      state.events = eventsData.events || [];
      state.bookingPriorityMode = state.events.length > 0;

      const themeData = await themeRes.json();
      if (themeData.theme) state.theme = themeData.theme;

      injectStyles();
      createWidget();

      // Check for resume
      const storedBooking = localStorage.getItem(BOOKING_KEY);
      if (storedBooking) {
        const booking = JSON.parse(storedBooking);
        checkBookingStatus(booking.bookingId);
      }
    } catch (e) {
      console.error("NochBot init failed", e);
      // Fallback
      injectStyles();
      createWidget();
    }
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #nb-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: ${state.theme.bubbleColor}; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 999999; transition: transform 0.2s; }
      #nb-bubble:hover { transform: scale(1.05); }
      #nb-window { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 600px; max-height: calc(100vh - 110px); background: #fff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 999999; display: none; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
      #nb-header { background: ${state.theme.headerColor}; padding: 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; }
      #nb-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .nb-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.5; }
      .nb-bot-msg { background: #f3f4f6; color: #1f2937; align-self: flex-start; border-bottom-left-radius: 4px; }
      .nb-user-msg { background: ${state.theme.userMsgColor}; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
      #nb-input-area { padding: 16px; border-top: 1px solid #f3f4f6; display: flex; gap: 8px; }
      #nb-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 14px; outline: none; }
      #nb-send { background: ${state.theme.sendBtnColor}; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600; }
      .nb-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 8px 0; background: #fff; }
      .nb-btn { display: block; width: 100%; padding: 10px; border-radius: 8px; border: 1px solid ${state.theme.accentColor}; background: #fff; color: ${state.theme.accentColor}; font-weight: 600; cursor: pointer; margin-top: 8px; text-align: center; font-size: 13px; }
      .nb-btn-primary { background: ${state.theme.accentColor} !important; color: #fff !important; }
    `;
    document.head.appendChild(style);
  }

  function createWidget() {
    const bubble = document.createElement("div");
    bubble.id = "nb-bubble";
    bubble.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    
    const chatWindow = document.createElement("div");
    chatWindow.id = "nb-window";
    chatWindow.innerHTML = `
      <div id="nb-header">
        <span style="font-weight:700">AI Assistant</span>
        <span id="nb-close" style="cursor:pointer">✕</span>
      </div>
      <div id="nb-messages"></div>
      <div id="nb-input-area">
        <input type="text" id="nb-input" placeholder="Type a message...">
        <button id="nb-send">Send</button>
      </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(chatWindow);

    bubble.onclick = () => {
      state.open = !state.open;
      chatWindow.style.display = state.open ? "flex" : "none";
      if (state.open && state.messages.length === 0) {
        sendGreeting();
      }
    };

    document.getElementById("nb-close").onclick = () => {
      state.open = false;
      chatWindow.style.display = "none";
    };

    document.getElementById("nb-send").onclick = () => handleUserInput();
    document.getElementById("nb-input").onkeydown = (e) => { if (e.key === "Enter") handleUserInput(); };
  }

  function addMessage(role, content) {
    const container = document.getElementById("nb-messages");
    if (!container) return;
    state.messages.push({ role, content });
    const msg = document.createElement("div");
    msg.className = `nb-msg ${role === "bot" ? "nb-bot-msg" : "nb-user-msg"}`;
    msg.textContent = content;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function addHtmlMessage(role, html) {
    const container = document.getElementById("nb-messages");
    if (!container) return;
    const msg = document.createElement("div");
    msg.className = `nb-msg ${role === "bot" ? "nb-bot-msg" : "nb-user-msg"}`;
    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function sendGreeting() {
    if (state.bookingPriorityMode) {
      const welcomeText = state.events.length === 1 
        ? `Hi! Tickets for ${escapeHtml(state.events[0].name)} are available. Would you like to book?`
        : "Hi! We have some exciting events coming up. Which one would you like to book?";
      addMessage("bot", welcomeText);
      renderEventList();
    } else {
      addMessage("bot", "Hello! How can I help you today?");
    }
  }

  function renderEventList() {
    state.events.forEach(event => {
      const date = new Date(event.start_at).toLocaleDateString();
      const price = event.is_paid ? `${event.currency} ${event.price}` : "Free";
      const cardHtml = `
        <div class="nb-card">
          <div style="font-weight:700;margin-bottom:4px">${escapeHtml(event.name)}</div>
          <div style="font-size:12px;color:#6b7280">${escapeHtml(date)} • ${escapeHtml(event.venue || "Global")}</div>
          <div style="font-size:12px;font-weight:600;margin-top:4px">${price}</div>
          <button class="nb-btn nb-btn-primary" onclick="NochBot.selectEvent('${event.id}')">Book Ticket</button>
        </div>
      `;
      addHtmlMessage("bot", cardHtml);
    });
  }

  async function handleUserInput() {
    const input = document.getElementById("nb-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMessage("user", text);

    if (state.activeBookingSession) {
      handleBookingAnswer(text);
      return;
    }

    // Fallback intent detector
    const bookingIntents = ["book", "ticket", "register", "attend", "buy"];
    if (bookingIntents.some(i => text.toLowerCase().includes(i)) && state.events.length > 0) {
      startBookingFlow();
      return;
    }

    state.loading = true;
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      addMessage("bot", data.text);

      if (data.action?.type === "START_BOOKING" && state.events.length > 0) {
        startBookingFlow(data.action.eventId);
      } else if (state.bookingPriorityMode) {
        // Soft CTA
        const event = state.events[0];
        addHtmlMessage("bot", `
          <div class="nb-card" style="border-left: 3px solid ${state.theme.accentColor}">
            <p style="margin:0 0 8px;font-size:13px">Interested in ${escapeHtml(event.name)}?</p>
            <button class="nb-btn nb-btn-primary" onclick="NochBot.selectEvent('${event.id}')">Book Now</button>
          </div>
        `);
      }
    } catch (e) {
      addMessage("bot", "I'm sorry, I'm having trouble connecting right now.");
    } finally {
      state.loading = false;
    }
  }

  async function startBookingFlow(eventId) {
    let targetEventId = eventId;
    if (!targetEventId && state.events.length === 1) {
      targetEventId = state.events[0].id;
    }

    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          visitorId: state.visitorId,
          chatSessionId: state.chatSessionId,
          eventId: targetEventId
        })
      });
      const session = await res.json();
      state.activeBookingSession = session;
      renderCurrentSessionStep();
    } catch (e) {
      addMessage("bot", "I couldn't start the booking flow. Please try again.");
    }
  }

  async function handleBookingAnswer(text) {
    if (!state.activeBookingSession) return;
    const session = state.activeBookingSession;
    
    let action = "";
    let payload = { userId, visitorId: state.visitorId };

    if (session.current_step === "quantity") {
      action = "set_quantity";
      payload.quantity = parseInt(text);
    } else if (session.current_step === "collect_field") {
      action = "answer_field";
      // Need fieldId
      const eventDataRes = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
      const eventData = await eventDataRes.json();
      const currentField = eventData.fields[session.current_field_index];
      payload.fieldId = currentField.id;
      payload.value = text;
    } else {
      return; // Not an input step
    }

    payload.action = action;

    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.error) {
        addMessage("bot", "⚠️ " + result.error);
        return;
      }
      state.activeBookingSession = result;
      renderCurrentSessionStep();
    } catch (e) {
      addMessage("bot", "Something went wrong saving your answer.");
    }
  }

  async function renderCurrentSessionStep() {
    const session = state.activeBookingSession;
    if (!session) return;

    switch (session.current_step) {
      case "select_event":
        addMessage("bot", "Please select an event to continue:");
        renderEventList();
        break;
      case "quantity":
        addMessage("bot", "How many tickets would you like to book?");
        break;
      case "collect_field":
        const eventRes = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
        const eventData = await eventRes.json();
        const field = eventData.fields[session.current_field_index];
        addMessage("bot", `Please enter your ${escapeHtml(field.label)}:`);
        break;
      case "summary":
        const ev = state.events.find(e => e.id === session.event_id);
        const total = ev.is_paid ? `${ev.currency} ${ev.price * session.quantity}` : "Free";
        addHtmlMessage("bot", `
          <div class="nb-card">
            <div style="font-weight:700;margin-bottom:8px">Booking Summary</div>
            <div style="font-size:12px;margin-bottom:4px"><b>Event:</b> ${escapeHtml(ev.name)}</div>
            <div style="font-size:12px;margin-bottom:4px"><b>Quantity:</b> ${session.quantity}</div>
            <div style="font-size:12px;margin-bottom:12px"><b>Total:</b> ${total}</div>
            <button class="nb-btn nb-btn-primary" onclick="NochBot.confirmBooking()">Confirm & Proceed</button>
          </div>
        `);
        break;
      case "payment":
        addMessage("bot", "Your payment is pending. Please complete it to receive your ticket.");
        break;
      case "complete":
        addMessage("bot", "Success! Your booking is confirmed.");
        if (session.booking_id) {
          addHtmlMessage("bot", `
            <a href="${API_BASE}/api/embed/bookings/${session.booking_id}/ticket?userId=${userId}&visitorId=${state.visitorId}" class="nb-btn nb-btn-primary" target="_blank">Download Ticket</a>
          `);
        }
        break;
    }
  }

  async function confirmBooking() {
    const session = state.activeBookingSession;
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, visitorId: state.visitorId })
      });
      const result = await res.json();
      
      if (result.status === "confirmed") {
        addMessage("bot", `Confirmed! Booking ID: ${result.booking_code}`);
        addHtmlMessage("bot", `
          <a href="${API_BASE}${result.download_url}" class="nb-btn nb-btn-primary" target="_blank">Download Ticket</a>
        `);
        state.activeBookingSession = null;
        localStorage.removeItem(BOOKING_KEY);
      } else if (result.status === "checkout_pending") {
        addMessage("bot", "Redirecting you to secure payment...");
        localStorage.setItem(BOOKING_KEY, JSON.stringify({
          sessionId: session.session_id,
          bookingId: result.booking_id,
          eventId: session.event_id,
          status: "checkout_pending",
          updatedAt: Date.now()
        }));
        setTimeout(() => {
          globalThis.location.href = result.checkoutUrl;
        }, 1500);
      }
    } catch (e) {
      addMessage("bot", "Failed to confirm booking.");
    }
  }

  async function checkBookingStatus(bookingId) {
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/${bookingId}/status?userId=${userId}&visitorId=${state.visitorId}`);
      const data = await res.json();
      
      if (data.status === "confirmed" && data.can_download_ticket) {
        addMessage("bot", "Welcome back! Your ticket is ready.");
        addHtmlMessage("bot", `<a href="${API_BASE}${data.download_url}" class="nb-btn nb-btn-primary" target="_blank">Download Ticket</a>`);
        localStorage.removeItem(BOOKING_KEY);
      } else if (data.status === "pending_payment") {
        addMessage("bot", "You have a pending booking. Please complete payment.");
      } else {
        localStorage.removeItem(BOOKING_KEY);
      }
    } catch (e) {
      localStorage.removeItem(BOOKING_KEY);
    }
  }

  // Global exports for onclick handlers
  globalThis.NochBot = {
    selectEvent: (id) => startBookingFlow(id),
    confirmBooking: () => confirmBooking()
  };

  init();
})();
