(function () {
  const scriptTag = document.currentScript;
  const userId = scriptTag.getAttribute("data-user-id");
  const API_BASE = window.location.origin;

  if (!userId) {
    console.error("NochBot Error: data-user-id is required.");
    return;
  }

  // --- Identity Management ---
  const VISITOR_KEY = "nb_visitor_" + userId;
  const SESSION_KEY = "nb_session_" + userId;
  const BOOKING_KEY = "nb_booking_" + userId;

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = "v_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function getChatSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "s_" + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  const state = {
    isOpen: false,
    messages: [],
    visitorId: getVisitorId(),
    chatSessionId: getChatSessionId(),
    activeBookingSession: null,
    isBookingMode: false,
    botName: "Assistant",
    botColor: "#36f4a4",
    botIcon: "",
    theme: null
  };

  // --- Styles ---
  const style = document.createElement("style");
  style.textContent = `
    #nb-widget-container { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: system-ui, -apple-system, sans-serif; }
    #nb-bubble { width: 56px; height: 56px; border-radius: 50%; background: #36f4a4; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }
    #nb-bubble:hover { transform: scale(1.05); }
    #nb-bubble svg { width: 24px; height: 24px; color: #000; }
    #nb-chat-window { position: absolute; bottom: 70px; right: 0; width: 360px; height: 500px; background: #fff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; border: 1px solid #eee; }
    #nb-header { background: #36f4a4; padding: 14px 16px; display: flex; align-items: center; gap: 10px; color: #000; }
    #nb-header-name { font-weight: 700; font-size: 15px; }
    #nb-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flexDirection: column; gap: 12px; background: #f9fafb; }
    .nb-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; margin-bottom: 8px; }
    .nb-msg-user { align-self: flex-end; background: #36f4a4; color: #000; border-bottom-right-radius: 4px; }
    .nb-msg-bot { align-self: flex-start; background: #fff; color: #1f2937; border-bottom-left-radius: 4px; border: 1px solid #e5e7eb; }
    #nb-input-area { padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px; background: #fff; }
    #nb-input { flex: 1; border: 1px solid #ddd; border-radius: 99px; padding: 8px 14px; font-size: 13.5px; outline: none; }
    #nb-send { background: #36f4a4; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    
    /* Cards */
    .nb-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin-top: 8px; }
    .nb-card-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .nb-card-desc { font-size: 12px; color: #6b7280; margin-bottom: 10px; }
    .nb-btn { width: 100%; padding: 8px; border-radius: 8px; border: none; background: #36f4a4; color: #000; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .nb-btn:hover { opacity: 0.9; }
    .nb-btn-outline { background: #f3f4f6; border: 1px solid #e5e7eb; margin-bottom: 4px; }
    
    /* Summary */
    .nb-summary-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
    .nb-summary-label { color: #6b7280; }
    .nb-summary-value { font-weight: 600; text-align: right; }
  `;
  document.head.appendChild(style);

  // --- UI Creation ---
  const container = document.createElement("div");
  container.id = "nb-widget-container";
  container.innerHTML = `
    <div id="nb-chat-window">
      <div id="nb-header">
        <div id="nb-header-name">Assistant</div>
      </div>
      <div id="nb-messages"></div>
      <div id="nb-input-area">
        <input type="text" id="nb-input" placeholder="Type a message...">
        <button id="nb-send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
    <div id="nb-bubble">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </div>
  `;
  document.body.appendChild(container);

  const bubble = document.getElementById("nb-bubble");
  const chatWindow = document.getElementById("nb-chat-window");
  const messagesDiv = document.getElementById("nb-messages");
  const input = document.getElementById("nb-input");
  const sendBtn = document.getElementById("nb-send");
  const header = document.getElementById("nb-header");

  // --- Logic ---
  function toggleChat() {
    state.isOpen = !state.isOpen;
    chatWindow.style.display = state.isOpen ? "flex" : "none";
    if (state.isOpen && state.messages.length === 0) {
      initChat();
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function initChat() {
    // 1. Fetch theme/config
    try {
      const res = await fetch(`${API_BASE}/api/theme?userId=${userId}`);
      const data = await res.json();
      if (data.theme) {
        state.theme = data.theme;
        state.botColor = data.theme.headerColor;
        applyTheme();
      }
    } catch (e) {}

    // 2. Check for existing booking status to resume
    const savedBooking = localStorage.getItem(BOOKING_KEY);
    if (savedBooking) {
      await checkBookingResume(JSON.parse(savedBooking));
      return;
    }

    // 3. Start standard flow
    try {
      const res = await fetch(`${API_BASE}/api/embed/events?userId=${userId}`);
      const data = await res.json();
      if (data.events && data.events.length > 0) {
        state.isBookingMode = true;
        if (data.events.length === 1) {
          startBookingFlow(data.events[0].id);
        } else {
          addMessage("bot", "Hello! Would you like to book tickets for one of our upcoming events?");
          renderEventList(data.events);
        }
      } else {
        addMessage("bot", "Hi! How can I help you today?");
      }
    } catch (e) {
      addMessage("bot", "Hi! How can I help you today?");
    }
  }

  async function checkBookingResume(booking) {
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/${booking.bookingId}/status?userId=${userId}&visitorId=${state.visitorId}`);
      const statusData = await res.json();

      if (res.ok) {
        if (statusData.status === "confirmed") {
          addMessage("bot", "You have an active booking! You can download your ticket below.");
          renderTicketCard({ ...statusData, booking_id: booking.bookingId });
        } else if (statusData.status === "pending_payment") {
          addMessage("bot", "You have a pending payment for your booking.");
          renderPaymentPendingCard(statusData);
        } else {
          // Stale or failed, start over
          localStorage.removeItem(BOOKING_KEY);
          initChat();
        }
      } else {
        localStorage.removeItem(BOOKING_KEY);
        initChat();
      }
    } catch (e) {
      localStorage.removeItem(BOOKING_KEY);
      initChat();
    }
  }

  function applyTheme() {
    if (!state.theme) return;
    header.style.background = state.theme.headerColor;
    bubble.style.background = state.theme.bubbleColor;
    sendBtn.style.background = state.theme.sendBtnColor;
    // Header text color check
    const headerName = document.getElementById("nb-header-name");
    headerName.style.color = isLight(state.theme.headerColor) ? "#000" : "#fff";
  }

  function isLight(color) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  }

  function addMessage(role, content) {
    state.messages.push({ role, content });
    const div = document.createElement("div");
    div.className = `nb-msg nb-msg-${role}`;
    div.textContent = content;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addMessage("user", text);

    if (state.isBookingMode && state.activeBookingSession) {
      handleBookingAnswer(text);
    } else {
      handleStandardChat(text);
    }
  }

  async function handleStandardChat(text) {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          visitorId: state.visitorId,
          sessionId: state.chatSessionId,
          sourceUrl: window.location.href,
          messages: state.messages
        }),
      });
      const data = await res.json();
      addMessage("bot", data.text || "I'm sorry, I couldn't process that.");
      if (data.action?.type === "START_BOOKING") {
        initChat();
      }
    } catch (e) {
      addMessage("bot", "Network error. Please try again.");
    }
  }

  // --- Booking Conversational Handlers ---
  async function handleBookingAnswer(text) {
    const session = state.activeBookingSession;
    let action = "answer_field";
    let payload = { value: text };

    if (session.current_step === "quantity") {
      action = "set_quantity";
      payload = { quantity: text };
    } else if (session.current_step === "collect_field") {
      const fieldsRes = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
      const fieldsData = await fieldsRes.json();
      const currentField = fieldsData.fields[session.current_field_index];
      payload.fieldId = currentField.id;
    }

    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          visitorId: state.visitorId,
          action,
          ...payload
        })
      });
      const data = await res.json();
      if (!res.ok) {
        addMessage("bot", data.error || "That input doesn't seem right. Could you try again?");
        return;
      }
      state.activeBookingSession = data;
      renderCurrentSessionStep();
    } catch (e) {
      addMessage("bot", "I'm having trouble processing that. Let's try again.");
    }
  }

  async function startBookingFlow(eventId) {
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          visitorId: state.visitorId,
          chatSessionId: state.chatSessionId,
          eventId
        })
      });
      const data = await res.json();
      state.activeBookingSession = data;
      state.isBookingMode = true;
      renderCurrentSessionStep();
    } catch (e) {
      addMessage("bot", "Sorry, I couldn't start the booking. Let's chat instead.");
      state.isBookingMode = false;
    }
  }

  async function renderCurrentSessionStep() {
    const session = state.activeBookingSession;
    if (!session) return;

    switch (session.current_step) {
      case "select_event":
        const evRes = await fetch(`${API_BASE}/api/embed/events?userId=${userId}`);
        const evData = await evRes.json();
        renderEventList(evData.events);
        break;
      case "quantity":
        addMessage("bot", "How many tickets would you like to book?");
        break;
      case "collect_field":
        const fieldsRes = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
        const fieldsData = await fieldsRes.json();
        const field = fieldsData.fields[session.current_field_index];
        addMessage("bot", `Please enter the ${field.label}:`);
        break;
      case "summary":
        renderSummaryCard();
        break;
      case "payment":
        addMessage("bot", "Your payment is pending. Please complete the checkout.");
        break;
      case "complete":
        addMessage("bot", "Great news! Your booking is confirmed.");
        // We'll need a check here if status is confirmed
        break;
    }
  }

  // --- Cards & Components ---
  function renderEventList(events) {
    const card = document.createElement("div");
    card.className = "nb-card";
    card.innerHTML = `<div class="nb-card-title">Available Events</div>`;
    events.forEach(e => {
      const btn = document.createElement("button");
      btn.className = "nb-btn nb-btn-outline";
      btn.textContent = e.name;
      btn.onclick = () => startBookingFlow(e.id);
      card.appendChild(btn);
    });
    messagesDiv.appendChild(card);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function renderSummaryCard() {
    const session = state.activeBookingSession;
    const evRes = await fetch(`${API_BASE}/api/embed/events/${session.event_id}?userId=${userId}`);
    const { event } = await evRes.json();
    
    const card = document.createElement("div");
    card.className = "nb-card";
    
    let rowsHtml = `
      <div class="nb-summary-row"><span class="nb-summary-label">Event</span><span class="nb-summary-value">${escapeHtml(event.name)}</span></div>
      <div class="nb-summary-row"><span class="nb-summary-label">Tickets</span><span class="nb-summary-value">${session.quantity}</span></div>
    `;
    
    session.answers.forEach(a => {
      rowsHtml += `<div class="nb-summary-row"><span class="nb-summary-label">${escapeHtml(a.label)}</span><span class="nb-summary-value">${escapeHtml(a.value)}</span></div>`;
    });

    const total = event.is_paid ? (event.price * session.quantity).toFixed(2) : 0;
    rowsHtml += `<div class="nb-summary-row" style="border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px;"><span class="nb-summary-label">Total</span><span class="nb-summary-value" style="color:#000">${total} ${event.currency}</span></div>`;

    card.innerHTML = `
      <div class="nb-card-title">Review Booking</div>
      <div style="margin-bottom: 12px;">${rowsHtml}</div>
    `;

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "nb-btn";
    confirmBtn.textContent = event.is_paid ? "Proceed to Payment" : "Confirm Free Booking";
    confirmBtn.onclick = () => finalizeBooking();
    
    card.appendChild(confirmBtn);
    messagesDiv.appendChild(card);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function finalizeBooking() {
    const session = state.activeBookingSession;
    addMessage("bot", "Confirming your booking...");
    
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${session.session_id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, visitorId: state.visitorId })
      });
      const result = await res.json();

      if (!res.ok) {
        addMessage("bot", result.error || "Booking failed. Please try again.");
        return;
      }

      if (result.status === "confirmed") {
        addMessage("bot", `Success! Your booking code is ${result.booking_code}.`);
        renderTicketCard(result);
        localStorage.removeItem(BOOKING_KEY);
        state.activeBookingSession = null;
      } else if (result.status === "checkout_pending") {
        localStorage.setItem(BOOKING_KEY, JSON.stringify({
          sessionId: session.session_id,
          bookingId: result.booking_id,
          eventId: session.event_id,
          status: "checkout_pending",
          updatedAt: Date.now()
        }));
        window.location.href = result.checkoutUrl;
      }
    } catch (e) {
      addMessage("bot", "Something went wrong during confirmation.");
    }
  }

  function renderTicketCard(result) {
    const card = document.createElement("div");
    card.className = "nb-card";
    card.innerHTML = `
      <div class="nb-card-title">Booking Confirmed!</div>
      <p class="nb-card-desc">Code: <strong>${result.booking_code}</strong></p>
      <a href="${API_BASE}/booking/ticket/${result.booking_id}?userId=${userId}&visitorId=${state.visitorId}" target="_blank" class="nb-btn" style="display:block; text-align:center; text-decoration:none;">
        Download Ticket
      </a>
    `;
    messagesDiv.appendChild(card);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function renderPaymentPendingCard(result) {
    const card = document.createElement("div");
    card.className = "nb-card";
    card.innerHTML = `
      <div class="nb-card-title">Payment Required</div>
      <p class="nb-card-desc">Complete your payment to receive your tickets.</p>
      <button class="nb-btn" id="resume-payment-btn">Finish Checkout</button>
    `;
    messagesDiv.appendChild(card);
    messagesDiv.querySelector("#resume-payment-btn").onclick = () => {
        // Find existing checkout_url if possible, otherwise restart
        initChat();
    };
  }

  // --- Events ---
  bubble.onclick = toggleChat;
  sendBtn.onclick = handleSend;
  input.onkeydown = (e) => e.key === "Enter" && handleSend();

})();
