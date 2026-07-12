
(function() {
  const scriptTag = document.currentScript;
  const userId = scriptTag.getAttribute('data-user-id');
  if (!userId) return;

  const API_BASE = new URL(scriptTag.src).origin;
  const VISITOR_KEY = `nb_visitor_${userId}`;
  const SESSION_KEY = `nb_session_${userId}`;
  const STORAGE_BOOKING_KEY = `nb_booking_${userId}`;

  let container, bubble, chatWindow, messageArea, input;
  let state = {
    isOpen: false,
    messages: [],
    visitorId: localStorage.getItem(VISITOR_KEY) || (() => {
      const id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
      return id;
    })(),
    chatSessionId: sessionStorage.getItem(SESSION_KEY) || (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    })(),
    booking: JSON.parse(localStorage.getItem(STORAGE_BOOKING_KEY) || "null")
  };

  function createUI() {
    container = document.createElement('div');
    container.id = 'nb-chat-container';
    Object.assign(container.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    bubble = document.createElement('button');
    Object.assign(bubble.style, {
      width: '60px', height: '60px', borderRadius: '30px', background: '#36f4a4',
      border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    bubble.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    bubble.onclick = toggleChat;

    chatWindow = document.createElement('div');
    Object.assign(chatWindow.style, {
      display: 'none', width: '380px', height: '520px', background: '#fff',
      borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      flexDirection: 'column', position: 'absolute', bottom: '80px', right: '0'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      background: '#36f4a4', padding: '16px 20px', color: '#fff',
      display: 'flex', alignItems: 'center', gap: '12px'
    });
    header.innerHTML = '<div style="width:32px;height:32px;background:rgba(0,0,0,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center">🤖</div><div><div style="font-weight:bold;font-size:14px">AI Assistant</div><div style="font-size:11px;opacity:0.8">Online</div></div>';

    messageArea = document.createElement('div');
    Object.assign(messageArea.style, { flex: '1', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' });

    const inputArea = document.createElement('div');
    Object.assign(inputArea.style, { padding: '16px', borderTop: '1px solid #eee', display: 'flex', gap: '10px' });
    
    input = document.createElement('input');
    Object.assign(input.style, { flex: '1', border: '1px solid #ddd', borderRadius: '20px', padding: '8px 16px', outline: 'none', fontSize: '14px' });
    input.placeholder = 'Type a message...';
    input.onkeydown = (e) => { if (e.key === 'Enter') handleSend(); };

    const sendBtn = document.createElement('button');
    Object.assign(sendBtn.style, { background: '#36f4a4', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer' });
    sendBtn.innerHTML = '➤';
    sendBtn.onclick = handleSend;

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    chatWindow.appendChild(header);
    chatWindow.appendChild(messageArea);
    chatWindow.appendChild(inputArea);
    container.appendChild(chatWindow);
    container.appendChild(bubble);
    document.body.appendChild(container);
  }

  function toggleChat() {
    state.isOpen = !state.isOpen;
    chatWindow.style.display = state.isOpen ? 'flex' : 'none';
    if (state.isOpen && state.messages.length === 0) {
      if (!checkBookingResume()) {
        addMessage('bot', 'Hi! How can I help you today?');
      }
    }
  }

  function addMessage(role, content) {
    state.messages.push({ role, content });
    const div = document.createElement('div');
    Object.assign(div.style, {
      maxWidth: '80%', padding: '10px 14px', borderRadius: '15px', fontSize: '13.5px',
      lineHeight: '1.5', alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      background: role === 'user' ? '#36f4a4' : '#f0f0f0',
      color: role === 'user' ? '#fff' : '#333'
    });
    div.innerText = content;
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function renderButtons(options) {
    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' });
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.innerText = opt.label;
      Object.assign(btn.style, {
        padding: '6px 14px', borderRadius: '15px', border: '1px solid #36f4a4',
        background: '#fff', color: '#36f4a4', cursor: 'pointer', fontSize: '12px'
      });
      btn.onclick = () => {
        opt.action();
        btnContainer.remove();
      };
      btnContainer.appendChild(btn);
    });
    messageArea.appendChild(btnContainer);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);
    if (state.booking) {
      handleBookingChat(text);
    } else {
      handleStandardChat(text);
    }
  }

  async function handleStandardChat(text) {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: state.messages.map(m => ({
            role: m.role === "bot" ? "assistant" : m.role,
            content: m.content
          })),
          userId,
          sessionId: state.chatSessionId,
          visitorId: state.visitorId,
          sourceUrl: globalThis.location.href
        })
      });
      const data = await res.json();
      addMessage('bot', data.text);
      if (data.action?.type === 'START_BOOKING') {
        startBookingFlow();
      }
    } catch (err) {
      addMessage('bot', 'Sorry, I encountered an error.');
    }
  }

  async function startBookingFlow(eventId = null) {
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, visitorId: state.visitorId, chatSessionId: state.chatSessionId, eventId })
      });
      const result = await res.json();
      updateBookingState(result);
      processBookingStep(result);
    } catch (err) {
      addMessage('bot', 'Could not start booking. Please try later.');
    }
  }

  function updateBookingState(result) {
    state.booking = {
      sessionId: result.session_id,
      currentStep: result.current_step,
      eventId: result.event_id,
      fieldIndex: result.current_field_index || 0,
      bookingId: result.booking_id
    };
    localStorage.setItem(STORAGE_BOOKING_KEY, JSON.stringify(state.booking));
  }

  async function processBookingStep(result) {
    const step = result.current_step;
    if (step === 'select_event') {
      const res = await fetch(`${API_BASE}/api/embed/events?userId=${userId}`);
      const data = await res.json();
      addMessage('bot', 'Which event would you like to attend?');
      renderButtons(data.events.map(e => ({
        label: `${e.name} (${e.is_paid ? `${e.currency} ${e.price}` : 'Free'})`,
        action: () => {
          addMessage('user', e.name);
          startBookingFlow(e.id);
        }
      })));
    } else if (step === 'quantity') {
      addMessage('bot', 'How many tickets would you like?');
    } else if (step === 'collect_field') {
      const eventRes = await fetch(`${API_BASE}/api/embed/events/${result.event_id}?userId=${userId}`);
      const eventData = await eventRes.json();
      const field = eventData.fields[result.current_field_index || 0];
      addMessage('bot', `Please enter your ${field.label}:`);
    } else if (step === 'summary') {
      addMessage('bot', 'All set! Please confirm your booking details.');
      renderButtons([
        { label: 'Confirm Booking', action: finalizeBooking },
        { label: 'Start Over', action: () => { localStorage.removeItem(STORAGE_BOOKING_KEY); state.booking = null; addMessage('bot', 'Session cleared. How else can I help?'); } }
      ]);
    } else if (step === 'payment') {
      addMessage('bot', 'Please complete your payment using the link below:');
      renderButtons([{ label: 'Pay Now', action: () => { globalThis.location.href = result.checkout_url; } }]);
      addMessage('bot', "Click the button below once you've finished the payment.");
      renderButtons([{ label: "I've completed payment", action: () => finalizeBooking() }]);
    } else if (step === 'complete') {
      renderTicketCard(result);
    }
  }

  async function handleBookingChat(text) {
    const b = state.booking;
    const action = b.currentStep === 'quantity' ? 'set_quantity' : 'answer_field';
    
    let payload = { userId, visitorId: state.visitorId, action };
    
    if (action === 'set_quantity') {
      payload.quantity = text;
    } else {
      const eventRes = await fetch(`${API_BASE}/api/embed/events/${b.eventId}?userId=${userId}`);
      const eventData = await eventRes.json();
      const field = eventData.fields[b.fieldIndex];
      payload.fieldId = field.id || field._id;
      payload.value = text;
    }

    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${b.sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      updateBookingState(result);
      processBookingStep(result);
    } catch (err) {
      addMessage('bot', 'Something went wrong updating your booking.');
    }
  }

  async function finalizeBooking() {
    try {
      const res = await fetch(`${API_BASE}/api/embed/bookings/session/${state.booking.sessionId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, visitorId: state.visitorId })
      });
      const result = await res.json();
      updateBookingState(result);
      processBookingStep(result);
    } catch (err) {
      addMessage('bot', 'Finalization failed. Please try again.');
    }
  }

  function renderTicketCard(result) {
    const div = document.createElement('div');
    Object.assign(div.style, {
      background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '12px',
      padding: '16px', marginTop: '10px', textAlign: 'center'
    });
    
    const bid = result.booking_id || (state.booking ? state.booking.bookingId : null);
    
    div.innerHTML = `<div style="font-weight:bold;margin-bottom:8px">🎉 Booking Confirmed!</div><div style="font-size:12px;margin-bottom:12px">Code: ${result.booking_code || '---'}</div>`;
    
    const dlBtn = document.createElement('a');
    dlBtn.href = `${API_BASE}/booking/ticket/${bid}?userId=${userId}&visitorId=${state.visitorId}`;
    dlBtn.target = '_blank';
    dlBtn.innerText = 'Download Ticket';
    Object.assign(dlBtn.style, {
      display: 'inline-block', padding: '8px 16px', background: '#36f4a4',
      color: '#fff', textDecoration: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold'
    });
    
    div.appendChild(dlBtn);
    messageArea.appendChild(div);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function checkBookingResume() {
    if (!state.booking) return false;
    fetch(`${API_BASE}/api/embed/bookings/${state.booking.bookingId || 'stale'}/status?userId=${userId}&visitorId=${state.visitorId}`)
      .then(r => r.json())
      .then(statusData => {
        if (statusData.status === 'confirmed') {
          addMessage('bot', 'Welcome back! Your previous booking is confirmed.');
          renderTicketCard({ ...statusData, booking_id: state.booking.bookingId });
        } else {
          addMessage('bot', 'Welcome back! You have an incomplete booking. Would you like to continue?');
          renderButtons([
            { label: 'Yes, resume', action: () => {
              fetch(`${API_BASE}/api/embed/bookings/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, visitorId: state.visitorId, chatSessionId: state.chatSessionId })
              }).then(r => r.json()).then(res => {
                updateBookingState(res);
                processBookingStep(res);
              });
            }},
            { label: 'No, clear session', action: () => { localStorage.removeItem(STORAGE_BOOKING_KEY); state.booking = null; addMessage('bot', 'Session cleared.'); }}
          ]);
        }
      }).catch(() => {
        localStorage.removeItem(STORAGE_BOOKING_KEY);
        state.booking = null;
      });
    return true;
  }

  createUI();
})();
