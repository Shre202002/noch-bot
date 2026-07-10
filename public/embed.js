(function() {
  const script = document.currentScript;
  const userId = script.getAttribute("data-user-id");
  if (!userId) return console.error("NochBot: Missing data-user-id");

  // Fix API_BASE to point to the NochBot backend domain
  const API_BASE = new URL(script.src).origin;
  const BOOKING_KEY = "nb_booking_" + userId;

  const state = {
    isOpen: false,
    messages: [],
    events: [],
    bookingPriorityMode: false,
    activeBookingSession: null,
    isBotTyping: false
  };

  // Initialize UI
  const bubble = document.createElement("div");
  bubble.id = "nb-bubble";
  bubble.innerHTML = `
    <div style="width: 60px; height: 60px; background: #36f4a4; border-radius: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform 0.2s;">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </div>
  `;
  bubble.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 999999;";
  document.body.appendChild(bubble);

  const chatWindow = document.createElement("div");
  chatWindow.id = "nb-window";
  chatWindow.style.cssText = "position: fixed; bottom: 90px; right: 20px; width: 380px; height: 500px; background: #fff; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; z-index: 999999; border: 1px solid #eee; font-family: system-ui, -apple-system, sans-serif;";
  chatWindow.innerHTML = `
    <div style="padding: 16px; background: #36f4a4; color: #000; font-weight: bold; display: flex; align-items: center; justify-content: space-between;">
      <span>NochBot Assistant</span>
      <button id="nb-close" style="background: none; border: none; cursor: pointer; font-size: 20px;">&times;</button>
    </div>
    <div id="nb-messages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb;"></div>
    <div id="nb-input-container" style="padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px;">
      <input id="nb-input" type="text" placeholder="Type a message..." style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px; outline: none;">
      <button id="nb-send" style="background: #36f4a4; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: bold;">Send</button>
    </div>
  `;
  document.body.appendChild(chatWindow);

  const messagesContainer = chatWindow.querySelector("#nb-messages");
  const inputField = chatWindow.querySelector("#nb-input");
  const sendButton = chatWindow.querySelector("#nb-send");

  function addMessage(role, content) {
    const msg = document.createElement("div");
    msg.className = `nb-msg ${role === "user" ? "nb-user-msg" : "nb-bot-msg"}`;
    msg.style.cssText = `max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; ${role === "user" ? "align-self: flex-end; background: #36f4a4; color: #000;" : "align-self: flex-start; background: #fff; color: #333; border: 1px solid #eee;"}`;
    msg.innerText = content;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    state.messages.push({ role, content });
  }

  function addCard(html) {
    const card = document.createElement("div");
    card.style.cssText = "width: 100%; background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 16px; margin-top: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);";
    card.innerHTML = html;
    messagesContainer.appendChild(card);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function handleSend() {
    const text = inputField.value.trim();
    if (!text) return;
    inputField.value = "";
    addMessage("user", text);

    // Guard: If in booking session, redirect to session handler
    if (state.activeBookingSession) {
      handleBookingAnswer(text);
      return;
    }

    // Normal Q&A Flow
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messages: state.messages.map(m => ({
            role: m.role === "bot" ? "assistant" : m.role,
            content: m.content
          })),
          sourceUrl: globalThis.location.href
        })
      });
      const data = await res.json();
      addMessage("bot", data.text || "I'm not sure how to answer that.");

      // Check for structured booking action (only if events exist)
      if (data.action?.type === "START_BOOKING" && state.events.length > 0) {
        startBookingFlow(data.action.eventId);
      } else if (state.bookingPriorityMode) {
        // Soft CTA if in booking mode
        addCard(`
          <p style="font-size: 12px; color: #666; margin: 0 0 8px;">Tickets are available for our upcoming events!</p>
          <button onclick="NochBot.startBooking()" style="background: #000; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Book Tickets</button>
        `);
      }
    } catch (err) {
      addMessage("bot", "Sorry, I'm having trouble connecting right now.");
    }
  }

  async function startBookingFlow(eventId = null) {
    addMessage("bot", "Great! Let's get you registered.");
    
    try {
      const visitorId = localStorage.getItem("nb_visitor_id") || "anon_" + Date.now();
      localStorage.setItem("nb_visitor_id", visitorId);

      const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, visitorId, eventId })
      });
      const session = await res.json();
      state.activeBookingSession = session;
      
      if (session.current_step === "select_event") {
        renderEventList();
      } else {
        renderCurrentSessionStep();
      }
    } catch (err) {
      addMessage("bot", "Failed to start booking. Please try again.");
    }
  }

  function renderEventList() {
    let html = `<p style="font-weight: bold; margin: 0 0 12px;">Select an event:</p>`;
    state.events.forEach(evt => {
      html += `
        <div style="border: 1px solid #eee; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
          <div style="font-weight: 600; font-size: 14px;">${evt.name}</div>
          <div style="font-size: 12px; color: #666;">${evt.venue || "Global"} • ${evt.is_paid ? evt.price + " " + evt.currency : "Free"}</div>
          <button onclick="NochBot.selectEvent('${evt.id}')" style="margin-top: 8px; width: 100%; background: #36f4a4; border: none; padding: 6px; border-radius: 4px; font-weight: bold; cursor: pointer;">Select</button>
        </div>
      `;
    });
    addCard(html);
  }

  // Global methods for button triggers
  globalThis.NochBot = {
    startBooking: () => startBookingFlow(),
    selectEvent: async (id) => {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${state.activeBookingSession.session_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select_event", eventId: id })
      });
      state.activeBookingSession = await res.json();
      renderCurrentSessionStep();
    }
  };

  async function renderCurrentSessionStep() {
    const session = state.activeBookingSession;
    if (session.current_step === "quantity") {
      addMessage("bot", "How many tickets would you like to book?");
      // Simple quantity selection could be added here
    } else if (session.current_step === "collect_field") {
      // Logic for field collection
    }
  }

  // Startup: Load events to decide mode
  (async function init() {
    try {
      const res = await fetch(`${API_BASE}/api/embed/events?userId=${userId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      state.events = data.events || [];
      state.bookingPriorityMode = state.events.length > 0;
    } catch (err) {
      state.bookingPriorityMode = false; // Fallback
    }

    bubble.onclick = () => {
      state.isOpen = !state.isOpen;
      chatWindow.style.display = state.isOpen ? "flex" : "none";
      if (state.isOpen && state.messages.length === 0) {
        if (state.bookingPriorityMode) {
          addMessage("bot", `Welcome! We have tickets available for ${state.events.length > 1 ? "several upcoming events" : state.events[0].name}. Would you like to book a spot?`);
          if (state.events.length === 1) {
            addCard(`
              <div style="font-weight: bold;">${state.events[0].name}</div>
              <p style="font-size: 12px; color: #666; margin: 4px 0 12px;">${state.events[0].description || ""}</p>
              <button onclick="NochBot.startBooking()" style="width: 100%; background: #000; color: #fff; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer;">Book Ticket</button>
            `);
          } else {
            renderEventList();
          }
        } else {
          addMessage("bot", "Hello! How can I help you today?");
        }
      }
    };

    chatWindow.querySelector("#nb-close").onclick = () => {
      state.isOpen = false;
      chatWindow.style.display = "none";
    };

    sendButton.onclick = handleSend;
    inputField.onkeypress = (e) => { if (e.key === "Enter") handleSend(); };
  })();
})();