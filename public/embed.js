(function() {
  const script = document.currentScript;
  const userId = script.getAttribute('data-user-id');
  const baseUrl = new URL(script.src).origin;
  const BOOKING_KEY = "nb_booking_" + userId;

  let state = {
    isOpen: false,
    messages: [],
    visitorId: localStorage.getItem('nb_visitor_id') || Math.random().toString(36).substring(7),
    booking: JSON.parse(localStorage.getItem(BOOKING_KEY) || 'null')
  };

  localStorage.setItem('nb_visitor_id', state.visitorId);

  // Styles & Injection
  const styles = `
    #nb-bubble { position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: #36f4a4; cursor: pointer; z-index: 9999; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }
    #nb-window { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 600px; max-height: 80vh; background: #fff; border-radius: 16px; display: none; flex-direction: column; z-index: 9999; box-shadow: 0 8px 24px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #eee; }
    #nb-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flexDirection: column; gap: 12px; }
    .nb-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.4; font-family: sans-serif; }
    .nb-bot { align-self: flex-start; background: #f1f1f1; color: #333; }
    .nb-user { align-self: flex-end; background: #36f4a4; color: #000; }
    .nb-input-area { padding: 12px; border-top: 1px solid #eee; display: flex; gap: 8px; }
    #nb-input { flex: 1; border: 1px solid #ddd; padding: 8px 12px; border-radius: 8px; outline: none; }
    .nb-card { border: 1px solid #eee; border-radius: 12px; padding: 12px; background: #fafafa; margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
    .nb-btn { background: #36f4a4; border: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px; }
  `;

  const styleTag = document.createElement('style');
  styleTag.innerHTML = styles;
  document.head.appendChild(styleTag);

  const container = document.createElement('div');
  container.innerHTML = `
    <div id="nb-bubble"><img src="${baseUrl}/nohbot.png" style="width:30px"></div>
    <div id="nb-window">
      <div style="background:#36f4a4; padding:16px; color:#000; font-weight:bold; font-family:sans-serif">NochBot Assistant</div>
      <div id="nb-messages"></div>
      <div class="nb-input-area">
        <input type="text" id="nb-input" placeholder="Type a message...">
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const bubble = document.getElementById('nb-bubble');
  const window = document.getElementById('nb-window');
  const messagesDiv = document.getElementById('nb-messages');
  const input = document.getElementById('nb-input');

  bubble.onclick = () => {
    state.isOpen = !state.isOpen;
    window.style.display = state.isOpen ? 'flex' : 'none';
    if (state.isOpen && state.messages.length === 0) addMessage('assistant', 'Hi! How can I help you today?');
  };

  function addMessage(role, content, action = null) {
    state.messages.push({ role, content });
    const msgDiv = document.createElement('div');
    msgDiv.className = `nb-msg ${role === 'assistant' ? 'nb-bot' : 'nb-user'}`;
    msgDiv.innerText = content;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (action) handleAction(action);
  }

  async function handleAction(action) {
    if (action.type === 'START_BOOKING') {
      const res = await fetch(`${baseUrl}/api/embed/events?userId=${userId}`);
      const data = await res.json();
      renderEventList(data.events);
    }
  }

  function renderEventList(events) {
    const card = document.createElement('div');
    card.className = 'nb-card';
    card.innerHTML = '<strong>Upcoming Events</strong>';
    events.forEach(e => {
      const btn = document.createElement('button');
      btn.className = 'nb-btn';
      btn.innerText = `Book ${e.name}`;
      btn.onclick = () => startSession(e.id);
      card.appendChild(btn);
    });
    messagesDiv.appendChild(card);
  }

  async function startSession(eventId) {
    const res = await fetch(`${baseUrl}/api/embed/bookings/session`, {
      method: 'POST',
      body: JSON.stringify({ userId, visitorId: state.visitorId, eventId })
    });
    const session = await res.json();
    state.booking = { sessionId: session.session_id };
    localStorage.setItem(BOOKING_KEY, JSON.stringify(state.booking));
    askQuantity();
  }

  function askQuantity() {
    addMessage('assistant', 'How many tickets would you like to book? (Enter a number)');
    state.bookingMode = 'quantity';
  }

  async function handleBookingInput(text) {
    if (state.bookingMode === 'quantity') {
      const res = await fetch(`${baseUrl}/api/embed/bookings/session/${state.booking.sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'set_quantity', quantity: text })
      });
      const data = await res.json();
      if (data.error) addMessage('assistant', data.error);
      else askFields(data);
    } else if (state.bookingMode === 'fields') {
      const res = await fetch(`${baseUrl}/api/embed/bookings/session/${state.booking.sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'answer_field', fieldId: state.currentFieldId, value: text })
      });
      const data = await res.json();
      if (data.error) addMessage('assistant', data.error);
      else askFields(data);
    }
  }

  async function askFields(session) {
    if (session.current_step === 'collect_field') {
      const eventRes = await fetch(`${baseUrl}/api/embed/events/${session.event_id}?userId=${userId}`);
      const eventData = await eventRes.json();
      const nextField = eventData.fields[session.current_field_index];
      state.currentFieldId = nextField.id;
      state.bookingMode = 'fields';
      addMessage('assistant', `Please provide your ${nextField.label}:`);
    } else if (session.current_step === 'summary') {
      renderSummary(session);
    }
  }

  function renderSummary(session) {
    const card = document.createElement('div');
    card.className = 'nb-card';
    card.innerHTML = `<strong>Booking Summary</strong><p>Tickets: ${session.quantity}</p>`;
    const btn = document.createElement('button');
    btn.className = 'nb-btn';
    btn.innerText = 'Confirm Booking';
    btn.onclick = async () => {
      const res = await fetch(`${baseUrl}/api/embed/bookings/session/${session._id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ userId, visitorId: state.visitorId })
      });
      const result = await res.json();
      if (result.status === 'confirmed') {
        addMessage('assistant', `Booking confirmed! Code: ${result.booking_code}`);
        const dl = document.createElement('a');
        dl.href = `${baseUrl}${result.download_url}`;
        dl.target = '_blank';
        dl.className = 'nb-btn';
        dl.innerText = 'Download Ticket';
        messagesDiv.appendChild(dl);
        localStorage.removeItem(BOOKING_KEY);
      } else if (result.checkoutUrl) {
        addMessage('assistant', 'Redirecting you to payment...');
        window.location.href = result.checkoutUrl;
      }
    };
    card.appendChild(btn);
    messagesDiv.appendChild(card);
  }

  input.onkeydown = async (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const text = input.value.trim();
      addMessage('user', text);
      input.value = '';

      if (state.bookingMode) {
        handleBookingInput(text);
      } else {
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          body: JSON.stringify({ userId, visitorId: state.visitorId, messages: state.messages })
        });
        const data = await res.json();
        addMessage('assistant', data.text, data.action);
      }
    }
  };
})();
