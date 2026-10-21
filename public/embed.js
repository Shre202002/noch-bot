(function () {
  if (window.NochBotWidgetLoaded) return;
  window.NochBotWidgetLoaded = true;

  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var origin = script && script.src ? new URL(script.src).origin : window.location.origin;
  var userId = script ? script.getAttribute('data-user-id') : null;
  var widgetId = script ? script.getAttribute('data-widget-id') : null;
  // Test mode (set by the dashboard for the signed-in organizer): nothing real is taken, sent or charged. The
  // server only honours it for the organizer's own session, so a copied tag on a public site does nothing.
  var testMode = !!script && script.getAttribute('data-test') === 'true';
  var testEventId = script ? script.getAttribute('data-event-id') : null;
  var autoOpen = !!script && script.getAttribute('data-open') === 'true';
  var storageKey = testMode ? 'nochbot_test_visitor_id' : 'nochbot_visitor_id';
  var chatKey = testMode ? 'nochbot_test_chat_session_id' : 'nochbot_chat_session_id';
  var visitorId = localStorage.getItem(storageKey) || cryptoRandomId('visitor');
  var chatSessionId = localStorage.getItem(chatKey) || cryptoRandomId('chat');

  localStorage.setItem(storageKey, visitorId);
  localStorage.setItem(chatKey, chatSessionId);

  var state = {
    open: false,
    loading: false,
    messages: [],
    bookingMode: null,
    botBookingSessionId: null,
    embedSession: null,
    embedEvent: null,
    embedFields: [],
    embedFieldIndex: 0
  };

  var theme = {
    bubbleColor: '#36f4a4',
    headerColor: '#111827',
    userMsgColor: '#36f4a4',
    sendBtnColor: '#36f4a4',
    accentColor: '#36f4a4'
  };

  function cryptoRandomId(prefix) {
    var bytes = new Uint8Array(12);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return prefix + '_' + Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    return prefix + '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var REQUEST_TIMEOUT_MS = 45000;
  // Visitors never see raw server errors. 4xx booking replies carry useful validation text and are kept;
  // rate limits, server faults, timeouts and network failures get a polite next step instead.
  var VISITOR_ERRORS = {
    network: "I couldn't reach the assistant. Check your connection and try again.",
    timeout: 'The assistant is taking too long to answer. Please try again.',
    limit: 'This assistant has reached its message limit for now. Please try again later or contact the website owner.',
    server: 'Something went wrong on our side. Please try again in a moment.'
  };

  function request(path, options) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, (options && options.timeoutMs) || REQUEST_TIMEOUT_MS) : null;
    return fetch(origin + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      signal: controller ? controller.signal : undefined
    }, options || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          if (res.status === 429) throw new Error(VISITOR_ERRORS.limit);
          if (res.status >= 500) throw new Error(VISITOR_ERRORS.server);
          throw new Error(data.message || data.error || VISITOR_ERRORS.server);
        }
        return data;
      });
    }, function (error) {
      throw new Error(error && error.name === 'AbortError' ? VISITOR_ERRORS.timeout : VISITOR_ERRORS.network);
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  function addMessage(role, text, extra) {
    var message = Object.assign({ role: role, text: text }, extra || {});
    // Bot replies type out like the dashboard preview; reduced motion shows them at once.
    if (role === 'assistant' && text && !reducedMotion()) message.typed = 0;
    state.messages.push(message);
    renderMessages();
    if (role === 'assistant') {
      announce(text);
      if (message.typed === 0) typeOut(message);
    }
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // Reveals a reply in about 2-3 seconds whatever its length; buttons and links appear once it is complete.
  function typeOut(message) {
    var step = Math.max(1, Math.ceil(message.text.length / 150));
    var timer = setInterval(function () {
      message.typed = Math.min(message.text.length, message.typed + step);
      if (message.typed >= message.text.length) {
        clearInterval(timer);
        delete message.typed;
        renderMessages();
        return;
      }
      var list = document.getElementById('nochbot-messages');
      var atBottom = list && list.scrollHeight - list.scrollTop - list.clientHeight < 48;
      if (message.bubble) renderRich(message.bubble, message.text.slice(0, message.typed), true);
      if (atBottom) list.scrollTop = list.scrollHeight;
    }, 18);
  }

  // Light formatting for bot replies, built with DOM nodes (never innerHTML): blank lines split paragraphs,
  // "- ", "* " or "1. " lines become lists, **text** becomes bold and "# " heading marks are dropped.
  function renderRich(el, text, typing) {
    el.textContent = '';
    var list = null;
    var para = null;
    text.split(/\r?\n/).forEach(function (line) {
      var t = line.trim().replace(/^#{1,6}\s+/, '');
      if (!t) { list = null; para = null; return; }
      var item = t.match(/^(?:[-*\u2022]|(\d+)[.)])\s+(.*)$/);
      if (item) {
        var tag = item[1] ? 'OL' : 'UL';
        if (!list || list.tagName !== tag) {
          list = document.createElement(tag);
          list.className = 'nochbot-list';
          if (item[1] && item[1] !== '1') list.setAttribute('start', item[1]);
          el.appendChild(list);
        }
        var li = document.createElement('li');
        appendInline(li, item[2]);
        list.appendChild(li);
        para = null;
        return;
      }
      list = null;
      if (para) para.appendChild(document.createElement('br'));
      else {
        para = document.createElement('p');
        el.appendChild(para);
      }
      appendInline(para, t);
    });
    if (typing) {
      var last = el.lastElementChild;
      if (last && last.lastElementChild && last.tagName !== 'P') last = last.lastElementChild;
      var caret = document.createElement('span');
      caret.className = 'nochbot-caret';
      (last || el).appendChild(caret);
    }
  }

  function appendInline(parent, text) {
    // An unclosed "**" while typing is already shown as bold, so the markers never flash on screen.
    text.split(/(\*\*[^*]+(?:\*\*|$))/).forEach(function (part) {
      if (!part) return;
      if (part.indexOf('**') === 0) {
        var strong = document.createElement('strong');
        strong.textContent = part.replace(/^\*\*|\*\*$/g, '');
        parent.appendChild(strong);
      } else {
        parent.appendChild(document.createTextNode(part));
      }
    });
  }

  function announce(text) {
    var live = document.getElementById('nochbot-live');
    if (!live) return;
    // Clear first so a repeated identical reply is still announced.
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 50);
  }

  function setLoading(value) {
    state.loading = value;
    renderMessages();
    var send = document.getElementById('nochbot-send');
    var input = document.getElementById('nochbot-input');
    var list = document.getElementById('nochbot-messages');
    if (send) send.disabled = value;
    // readOnly rather than disabled, so keyboard focus stays in the field while the reply loads.
    if (input) {
      input.readOnly = value;
      input.setAttribute('aria-busy', value ? 'true' : 'false');
    }
    if (list) list.setAttribute('aria-busy', value ? 'true' : 'false');
  }

  function renderMessages() {
    var list = document.getElementById('nochbot-messages');
    if (!list) return;

    list.innerHTML = '';
    state.messages.forEach(function (message) {
      var row = document.createElement('div');
      // Only messages appearing for the first time animate; the list is rebuilt on every render.
      row.className = 'nochbot-message-row ' + (message.role === 'user' ? 'is-user' : 'is-bot') + (message.shown ? '' : ' is-new');
      message.shown = true;

      var bubble = document.createElement('div');
      bubble.className = 'nochbot-message ' + (message.role === 'user' ? 'is-user' : 'is-bot');
      var typing = message.typed !== undefined;
      if (message.role === 'user') bubble.textContent = message.text;
      else {
        renderRich(bubble, typing ? message.text.slice(0, message.typed) : message.text, typing);
        message.bubble = bubble;
      }
      row.appendChild(bubble);
      if (typing) {
        list.appendChild(row);
        return;
      }

      if (message.actions && message.actions.length) {
        var actions = document.createElement('div');
        actions.className = 'nochbot-actions';
        message.actions.forEach(function (action) {
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'nochbot-action' + (action.primary ? ' is-primary' : '');
          button.textContent = action.label;
          button.addEventListener('click', action.onClick);
          actions.appendChild(button);
        });
        row.appendChild(actions);
      }

      var links = message.links || (message.link ? [Object.assign({ primary: true }, message.link)] : []);
      if (links.length) {
        var linkRow = document.createElement('div');
        linkRow.className = 'nochbot-actions';
        links.forEach(function (item) {
          var link = document.createElement('a');
          link.className = item.primary ? 'nochbot-pay-link' : 'nochbot-action';
          link.href = item.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          if (item.download) link.setAttribute('download', '');
          link.textContent = item.label;
          linkRow.appendChild(link);
        });
        row.appendChild(linkRow);
      }

      list.appendChild(row);
    });

    if (state.loading) {
      var typing = document.createElement('div');
      typing.className = 'nochbot-message-row is-bot';
      typing.setAttribute('aria-hidden', 'true');
      typing.innerHTML = '<div class="nochbot-message is-bot"><span class="nochbot-dot"></span><span class="nochbot-dot"></span><span class="nochbot-dot"></span>' +
        (state.loadingNote ? '<span class="nochbot-note"></span>' : '') + '</div>';
      if (state.loadingNote) typing.querySelector('.nochbot-note').textContent = state.loadingNote;
      list.appendChild(typing);
    }

    list.scrollTop = list.scrollHeight;
  }

  function normalMessagesForApi() {
    return state.messages
      .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
      .map(function (m) { return { role: m.role, content: m.text }; });
  }

  function sendMessage() {
    var input = document.getElementById('nochbot-input');
    if (!input || state.loading) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addMessage('user', text);

    if (state.bookingMode === 'bot') return sendBotBookingMessage(text);
    if (state.bookingMode === 'embed') return sendEmbedBookingMessage(text);
    return sendChatMessage();
  }

  function sendChatMessage() {
    if (!userId) {
      if (window.console) console.warn('[NochBot] The embed script tag is missing its data-user-id attribute.');
      addMessage('assistant', "This assistant isn't set up yet. Please contact the website owner.");
      return;
    }

    setLoading(true);
    // The first answer can be slow (cold server); say so instead of failing early.
    var slowTimer = setTimeout(function () { state.loadingNote = 'Still thinking…'; renderMessages(); }, 12000);
    request('/api/chat', {
      method: 'POST',
      timeoutMs: 90000,
      body: JSON.stringify({
        messages: normalMessagesForApi(),
        userId: userId,
        sessionId: chatSessionId,
        visitorId: visitorId,
        sourceUrl: window.location.href
      })
    }).then(function (data) {
      addMessage('assistant', data.text || 'I am here to help.');
      if (data.action && data.action.type === 'START_BOOKING') {
        startBooking();
      }
    }).catch(function (error) {
      addMessage('assistant', error.message || 'Sorry, something went wrong.');
    }).finally(function () {
      clearTimeout(slowTimer);
      state.loadingNote = null;
      setLoading(false);
    });
  }

  function startBooking() {
    if (widgetId) return startBotBooking();
    if (userId) return startEmbedBooking();
    addMessage('assistant', 'Booking is not configured for this chatbot.');
  }

  function startBotBooking() {
    state.bookingMode = 'bot';
    setLoading(true);
    request('/api/bot/booking/start', {
      method: 'POST',
      body: JSON.stringify({ chatbot_widget_id: widgetId })
    }).then(function (data) {
      state.botBookingSessionId = data.session_id;
      var event = data.event || {};
      var price = event.is_paid ? ' Price: ' + (event.currency || '') + ' ' + event.price + '.' : '';
      addMessage('assistant', 'Let us book your tickets for ' + (event.name || 'this event') + '.' + price + ' How many tickets would you like?');
    }).catch(function (error) {
      state.bookingMode = null;
      addMessage('assistant', error.message || 'I could not start booking right now.');
    }).finally(function () {
      setLoading(false);
    });
  }

  function sendBotBookingMessage(text) {
    if (!state.botBookingSessionId) return startBotBooking();
    setLoading(true);
    request('/api/bot/booking/' + encodeURIComponent(state.botBookingSessionId) + '/message', {
      method: 'POST',
      body: JSON.stringify({ message: text })
    }).then(function (data) {
      addMessage('assistant', data.bot_reply || 'Done.', data.payment_data && data.payment_data.checkoutUrl ? {
        link: { href: data.payment_data.checkoutUrl, label: 'Complete payment' }
      } : null);
      if (data.conversation_state === 'confirmed' || data.conversation_state === 'awaiting_payment') {
        state.bookingMode = null;
      }
    }).catch(function (error) {
      addMessage('assistant', error.message || 'I could not update the booking.');
    }).finally(function () {
      setLoading(false);
    });
  }

  // ── Website booking (data-user-id): the whole booking happens in the chat ────────────────────────────────
  // Event → quantity → registration form (one question at a time) → summary → confirm → (pay, watched here) →
  // Download PDF / View ticket. Questions typed mid-booking are answered, then the booking question is repeated.

  var PAYMENT_POLL_MS = 4000;
  var PAYMENT_WATCH_MS = 16 * 60 * 1000;
  var pendingKey = testMode ? 'nochbot_test_pending_booking' : 'nochbot_pending_booking';
  var QUESTION_RE = /\?\s*$|^(what|when|where|how|is|are|can|could|does|do|who|why|which|will|should|tell me)\b/i;
  var CANCEL_RE = /^(cancel|stop|stop booking|exit|quit|never ?mind)[.!]?$/i;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^\+?[0-9][0-9\s-]{6,16}$/;
  var paymentTimer = null;

  function loadEvents() {
    if (state.events) return Promise.resolve(state.events);
    return request('/api/embed/events?userId=' + encodeURIComponent(userId) + (testMode ? '&test=1' : ''), { method: 'GET' })
      .then(function (data) {
        state.events = data.events || [];
        // What the bubble beside the icon says: a live event to book, or an offer to help (decided by the server).
        state.teaser = data.teaser || null;
        state.teaserEventId = data.teaser_event_id || null;
        return state.events;
      });
  }

  function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return d.toString();
    }
  }

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'INR' }).format(amount);
    } catch (e) {
      return (currency || '') + ' ' + amount;
    }
  }

  function priceText(event) {
    return event.is_paid && event.price ? formatMoney(event.price, event.currency) + ' per ticket' : 'Free';
  }

  function startEmbedBooking() {
    state.bookingMode = 'embed';
    setLoading(true);
    loadEvents()
      .then(function (events) {
        var open = events.filter(function (e) { return e.available_seats > 0; });
        if (!open.length) {
          state.bookingMode = null;
          addMessage('assistant', events.length
            ? 'All upcoming events are sold out right now.'
            : 'There are no events open for booking right now.');
          return;
        }
        if (open.length === 1) return chooseEmbedEvent(open[0], true);
        addMessage('assistant', 'Which event would you like to book?', {
          actions: open.slice(0, 5).map(function (event) {
            return { label: event.name, onClick: function () { chooseEmbedEvent(event); } };
          })
        });
      }).catch(function (error) {
        state.bookingMode = null;
        addMessage('assistant', error.message || 'I could not load events right now.');
      }).finally(function () {
        setLoading(false);
      });
  }

  function chooseEmbedEvent(event, automatic) {
    state.bookingMode = 'embed';
    state.embedEvent = event;
    if (!automatic) addMessage('user', event.name);
    setLoading(true);
    request('/api/embed/events/' + encodeURIComponent(event.id) + '?userId=' + encodeURIComponent(userId) + (testMode ? '&test=1' : ''), { method: 'GET' })
      .then(function (eventData) {
        state.embedFields = eventData.fields || [];
        return request('/api/embed/bookings/session', {
          method: 'POST',
          body: JSON.stringify({ userId: userId, visitorId: visitorId, chatSessionId: chatSessionId, eventId: event.id, test: testMode })
        });
      }).then(function (session) {
        state.embedSession = session;
        askQuantity();
      }).catch(function (error) {
        state.bookingMode = null;
        addMessage('assistant', error.message || 'I could not start that booking.');
      }).finally(function () {
        setLoading(false);
      });
  }

  function maxTickets() {
    var event = state.embedEvent || {};
    var max = event.available_seats || 1;
    if (event.max_tickets_per_booking) max = Math.min(max, event.max_tickets_per_booking);
    return Math.max(1, max);
  }

  function askQuantity() {
    var event = state.embedEvent || {};
    var when = formatDate(event.date);
    var max = maxTickets();
    var lines = ['Booking: ' + event.name + (when ? ' (' + when + ')' : '') + '.',
      priceText(event) + ' · ' + event.available_seats + ' seat' + (event.available_seats === 1 ? '' : 's') + ' left.',
      'How many tickets would you like?' + (max > 1 ? ' (up to ' + max + ')' : '')];
    var options = [];
    for (var i = 1; i <= Math.min(max, 4); i++) options.push(i);
    addMessage('assistant', lines.join('\n'), {
      actions: options.map(function (n) {
        return { label: String(n), onClick: function () { addMessage('user', String(n)); setEmbedQuantity(String(n)); } };
      })
    });
  }

  function currentField() {
    return state.embedFields[(state.embedSession && state.embedSession.current_field_index) || 0];
  }

  /** True when the text is a valid answer for the field, so "what?"-shaped answers are not mistaken for questions. */
  function fitsField(field, text) {
    if (!field) return false;
    if (field.validation_rule === 'email_format') return EMAIL_RE.test(text);
    if (field.validation_rule === 'phone_format') return PHONE_RE.test(text);
    if (field.field_type === 'number') return /^-?\d+(\.\d+)?$/.test(text);
    if (field.field_type === 'select' && field.options) {
      return field.options.some(function (o) { return String(o).toLowerCase() === text.toLowerCase(); });
    }
    return false;
  }

  function looksLikeQuestion(text) {
    var step = state.embedSession && state.embedSession.current_step;
    if (step === 'quantity' && /^\d+$/.test(text)) return false;
    if (step === 'collect_field' && fitsField(currentField(), text)) return false;
    return QUESTION_RE.test(text);
  }

  function sendEmbedBookingMessage(text) {
    if (CANCEL_RE.test(text)) return cancelBooking();
    if (!state.embedSession || !state.embedEvent) return startEmbedBooking();
    if (looksLikeQuestion(text)) return answerAside(text);

    var step = state.embedSession.current_step;
    if (step === 'quantity') return setEmbedQuantity(text);
    if (step === 'collect_field') return answerEmbedField(text);
    if (step === 'summary') {
      if (/^(yes|y|confirm|ok|okay|sure|book it|pay)[.!]?$/i.test(text)) return confirmEmbedBooking();
      addMessage('assistant', 'Use the buttons below to confirm, edit or cancel this booking.');
      return showSummary();
    }
    addMessage('assistant', 'Let me start that booking again.');
    startEmbedBooking();
  }

  /** Answer a question with the website assistant, then bring the visitor back to the booking step. */
  function answerAside(text) {
    setLoading(true);
    request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        userId: userId,
        sessionId: chatSessionId,
        visitorId: visitorId,
        sourceUrl: window.location.href
      })
    }).then(function (data) {
      addMessage('assistant', data.text || 'I am not sure about that.');
    }).catch(function (error) {
      addMessage('assistant', error.message || 'I could not answer that right now.');
    }).finally(function () {
      setLoading(false);
      repromptStep(true);
    });
  }

  function repromptStep(afterAside) {
    var step = state.embedSession && state.embedSession.current_step;
    if (afterAside) addMessage('assistant', 'Back to your booking.');
    if (step === 'quantity') return askQuantity();
    if (step === 'collect_field') return askCurrentEmbedField();
    if (step === 'summary') return showSummary();
  }

  function cancelBooking() {
    state.bookingMode = null;
    state.embedSession = null;
    addMessage('assistant', 'Booking cancelled. Ask me anything, or say "book tickets" to start again.');
  }

  function updateEmbedSession(action, payload) {
    return request('/api/embed/bookings/session/' + encodeURIComponent(state.embedSession.session_id), {
      method: 'PATCH',
      body: JSON.stringify(Object.assign({ action: action, userId: userId, visitorId: visitorId }, payload || {}))
    }).then(function (session) {
      state.embedSession = session;
      return session;
    });
  }

  function setEmbedQuantity(text) {
    var n = parseInt(String(text).replace(/[^\d]/g, ''), 10);
    if (!n || n < 1) {
      addMessage('assistant', 'Please reply with a number of tickets, for example 2.');
      return;
    }
    if (n > maxTickets()) {
      addMessage('assistant', 'You can book up to ' + maxTickets() + ' ticket' + (maxTickets() === 1 ? '' : 's') + ' here.');
      return;
    }
    setLoading(true);
    updateEmbedSession('set_quantity', { quantity: n })
      .then(function (session) {
        if (session.current_step === 'summary') showSummary();
        else askCurrentEmbedField();
      }).catch(function (error) {
        addMessage('assistant', error.message || 'Please enter a valid ticket quantity.');
      }).finally(function () {
        setLoading(false);
      });
  }

  function askCurrentEmbedField() {
    var field = currentField();
    if (!field) return showSummary();
    var index = (state.embedSession.current_field_index || 0) + 1;
    var hint = '';
    if (field.validation_rule === 'email_format') hint = ' (your tickets will be emailed here)';
    else if (field.field_type === 'date') hint = ' (for example 2026-10-20)';
    else if (field.validation_rule === 'phone_format') hint = ' (digits, optionally starting with +)';
    var prompt = 'Question ' + index + ' of ' + state.embedFields.length + ': ' + field.label + hint +
      (field.is_required ? '' : '\nOptional: reply "skip" to leave it out.');

    var actions = [];
    if (field.field_type === 'select' && field.options && field.options.length) {
      actions = field.options.slice(0, 8).map(function (option) {
        return { label: String(option), onClick: function () { answerWith(String(option)); } };
      });
    } else if (field.field_type === 'boolean') {
      actions = ['Yes', 'No'].map(function (option) {
        return { label: option, onClick: function () { answerWith(option); } };
      });
    }
    if (!field.is_required) actions.push({ label: 'Skip', onClick: function () { answerWith('skip'); } });
    addMessage('assistant', prompt, actions.length ? { actions: actions } : null);
  }

  function answerWith(value) {
    addMessage('user', value);
    answerEmbedField(value);
  }

  function answerEmbedField(text) {
    var field = currentField();
    if (!field) return showSummary();
    var value = !field.is_required && /^skip$/i.test(text) ? '' : text;
    setLoading(true);
    updateEmbedSession('answer_field', { fieldId: field.id, value: value })
      .then(function (session) {
        if (session.current_step === 'summary') showSummary();
        else askCurrentEmbedField();
      }).catch(function (error) {
        addMessage('assistant', (error.message || 'That answer does not look valid.') + ' Please try again.');
      }).finally(function () {
        setLoading(false);
      });
  }

  function showSummary() {
    var event = state.embedEvent || {};
    var session = state.embedSession || {};
    var quantity = session.quantity || 1;
    var lines = ['Please check your booking:', 'Event: ' + event.name];
    var when = formatDate(event.date);
    if (when) lines.push('When: ' + when);
    if (event.venue) lines.push('Where: ' + event.venue);
    lines.push('Tickets: ' + quantity);
    (session.answers || []).forEach(function (a) {
      if (a.value !== '' && a.value !== null && a.value !== undefined) lines.push(a.label + ': ' + a.value);
    });
    var paid = event.is_paid && event.price;
    lines.push('Total: ' + (paid ? formatMoney(event.price * quantity, event.currency) : 'Free'));
    addMessage('assistant', lines.join('\n'), {
      actions: [
        { label: paid ? 'Confirm & pay' : 'Confirm booking', primary: true, onClick: function () { addMessage('user', 'Confirm'); confirmEmbedBooking(); } },
        { label: 'Edit details', onClick: function () { addMessage('user', 'Edit details'); chooseEmbedEvent(state.embedEvent, true); } },
        { label: 'Cancel', onClick: function () { addMessage('user', 'Cancel'); cancelBooking(); } }
      ]
    });
  }

  function confirmEmbedBooking() {
    setLoading(true);
    request('/api/embed/bookings/session/' + encodeURIComponent(state.embedSession.session_id) + '/confirm', {
      method: 'POST',
      body: JSON.stringify({ userId: userId, visitorId: visitorId })
    }).then(function (data) {
      state.bookingMode = null;
      state.embedSession = null;
      state.events = null; // seat counts changed
      if (data.status === 'checkout_pending' && data.checkoutUrl) return startPayment(data);
      showTickets(data, 'Your booking is confirmed' + (data.booking_code ? ' (booking ' + data.booking_code + ')' : '') + '.');
    }).catch(function (error) {
      addMessage('assistant', error.message || 'I could not confirm the booking.');
      if (state.embedSession) showSummary();
    }).finally(function () {
      setLoading(false);
    });
  }

  function showTickets(data, headline) {
    clearPending();
    var text = headline;
    if (data.emailed_to) text += '\nWe have also emailed your tickets to ' + data.emailed_to + '.';
    var links = [];
    if (data.ticket_pdf_url) links.push({ href: normalizeUrl(data.ticket_pdf_url), label: 'Download PDF', download: true, primary: true });
    if (data.ticket_page_url) links.push({ href: normalizeUrl(data.ticket_page_url), label: 'View ticket' });
    addMessage('assistant', text, links.length ? { links: links } : null);
  }

  // ── Payment: checkout opens in a new tab; the chat watches the booking until it is settled ──────────────

  function startPayment(data) {
    savePending({ bookingId: data.booking_id, startedAt: Date.now(), checkoutUrl: data.checkoutUrl });
    addMessage('assistant', testMode
      ? 'Test payment: no real seats are held and no money moves. Open the test payment page, press Pay (test), and your test ticket will show up here.'
      : 'Your seats are reserved for 15 minutes. Complete the payment to confirm your booking. I will show your tickets here as soon as it goes through.', {
      links: [{ href: normalizeUrl(data.checkoutUrl), label: 'Pay now', primary: true }]
    });
    watchPayment(data.booking_id, Date.now());
  }

  function watchPayment(bookingId, startedAt) {
    if (paymentTimer) clearInterval(paymentTimer);
    var announcedWaiting = false;
    var check = function () {
      if (Date.now() - startedAt > PAYMENT_WATCH_MS) {
        clearInterval(paymentTimer);
        paymentTimer = null;
        return;
      }
      request('/api/embed/bookings/' + encodeURIComponent(bookingId) + '/status?userId=' + encodeURIComponent(userId) + '&visitorId=' + encodeURIComponent(visitorId), { method: 'GET' })
        .then(function (status) {
          if (status.status === 'confirmed' && status.can_download_ticket) {
            clearInterval(paymentTimer);
            paymentTimer = null;
            showTickets(status, 'Payment received. Your booking is confirmed' + (status.booking_code ? ' (booking ' + status.booking_code + ')' : '') + '.');
          } else if (status.status === 'failed' || status.status === 'cancelled') {
            stopWatching();
            addMessage('assistant', "The payment didn't go through, so the booking was not completed.", {
              actions: [{ label: 'Try again', onClick: function () { addMessage('user', 'Try again'); startEmbedBooking(); } }]
            });
          } else if (status.status === 'expired') {
            stopWatching();
            addMessage('assistant', 'The 15-minute reservation expired before payment was completed, so the seats were released.', {
              actions: [{ label: 'Start again', onClick: function () { addMessage('user', 'Start again'); startEmbedBooking(); } }]
            });
          } else if (status.status === 'needs_refund') {
            stopWatching();
            addMessage('assistant', 'Your payment arrived after the reservation expired and the event is now full. The organizer has been notified to refund you.');
          } else if (!announcedWaiting && Date.now() - startedAt > 60000) {
            announcedWaiting = true;
            addMessage('assistant', 'Still waiting for the payment confirmation. Finish paying in the other tab; this updates automatically.');
          }
        })
        .catch(function () { /* transient: keep checking */ });
    };
    paymentTimer = setInterval(check, PAYMENT_POLL_MS);
    check();
  }

  function stopWatching() {
    if (paymentTimer) clearInterval(paymentTimer);
    paymentTimer = null;
    clearPending();
  }

  function savePending(value) {
    try { localStorage.setItem(pendingKey, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  function clearPending() {
    try { localStorage.removeItem(pendingKey); } catch (e) { /* storage unavailable */ }
  }

  /** A payment started before the page was reloaded: keep watching it. */
  function resumePendingPayment() {
    var pending = null;
    try { pending = JSON.parse(localStorage.getItem(pendingKey) || 'null'); } catch (e) { pending = null; }
    if (!pending || !pending.bookingId) return;
    if (Date.now() - pending.startedAt > PAYMENT_WATCH_MS) return clearPending();
    addMessage('assistant', 'Checking the payment for your booking…', pending.checkoutUrl ? {
      links: [{ href: normalizeUrl(pending.checkoutUrl), label: 'Pay now' }]
    } : null);
    watchPayment(pending.bookingId, pending.startedAt);
  }

  /** Test mode: explain what is happening, then start the booking for the chosen event straight away. */
  function startTestSession() {
    if (!userId) return addMessage('assistant', 'This test could not start because the script has no user id.');
    addMessage('assistant', 'This is a test booking. Nothing real is taken: no seats, no emails and no money. Book as an attendee would; afterwards it shows in Bookings as a TESTED TICKET.');
    state.bookingMode = 'embed';
    loadEvents().then(function (events) {
      var event = testEventId ? events.filter(function (e) { return e.id === testEventId; })[0] : events[0];
      if (!event) {
        state.bookingMode = null;
        addMessage('assistant', 'This event is not ready to test yet. Finish every setup step first, then try again.');
        return;
      }
      return chooseEmbedEvent(event, true);
    }).catch(function (error) {
      state.bookingMode = null;
      addMessage('assistant', error.message || 'I could not start the test booking.');
    });
  }

  /** First message written for the crawled site, then a booking offer when the organizer has events open. */
  function greet() {
    var fallback = "Hi! I'm the assistant for this website. How can I help you today?";
    if (!userId) return addMessage('assistant', fallback);
    var greeting = request('/api/widget/greeting?userId=' + encodeURIComponent(userId), { method: 'GET' })
      .catch(function () { return { greeting: fallback }; });
    var events = loadEvents().catch(function () { return []; });
    Promise.all([greeting, events]).then(function (results) {
      var info = results[0] || {};
      var text = info.greeting || fallback;
      setAssistantName(info.siteName);
      showTeaser(state.teaser || "I'm here to help you.");
      var open = (results[1] || []).filter(function (e) { return e.available_seats > 0; });
      if (!open.length) return addMessage('assistant', text);
      // One message, not two: the welcome and the live event read as a single thought, with the booking button below.
      var names = open.length === 1 ? open[0].name
        : open.length === 2 ? open[0].name + ' and ' + open[1].name
        : open[0].name + ', ' + open[1].name + ' and ' + (open.length - 2) + ' more';
      addMessage('assistant', text + '\n\n' + names + (open.length === 1 ? ' is' : ' are') + ' live. You can book your tickets right here in the chat.', {
        actions: [{ label: 'Book tickets', primary: true, onClick: function () { addMessage('user', 'Book tickets'); startEmbedBooking(); } }]
      });
    }).finally(resumePendingPayment);
  }

  function normalizeUrl(value) {
    if (/^https?:\/\//i.test(value)) return value;
    return origin + value;
  }

  // ── Shell: launcher, teaser, panel and theme ─────────────────────────────────────────────────────────────

  var BOT_ICON = '<svg class="nochbot-bot-icon" viewBox="0 0 1700 1700" fill="currentColor" aria-hidden="true"><path d="M1148.5,1552.1h-597c-75,0-145.5-29.2-198.5-82.2s-82.2-123.5-82.2-198.5V920.7c0-75,29.2-145.5,82.2-198.5 S476.5,640,551.5,640h597c75,0,145.5,29.2,198.5,82.2s82.2,123.5,82.2,198.5v350.6c0,75-29.2,145.5-82.2,198.5 C1294,1522.9,1223.5,1552.1,1148.5,1552.1z M551.5,688c-128.3,0-232.7,104.4-232.7,232.7v350.6c0,128.3,104.4,232.7,232.7,232.7 h597c128.3,0,232.7-104.4,232.7-232.7V920.7c0-128.3-104.4-232.7-232.7-232.7H551.5z"/><path d="M626.1,1109.7c-64.4,0-116.8-52.4-116.8-116.8s52.4-116.8,116.8-116.8s116.8,52.4,116.8,116.8 S690.5,1109.7,626.1,1109.7z M626.1,924.1c-37.9,0-68.8,30.9-68.8,68.8s30.9,68.8,68.8,68.8c37.9,0,68.8-30.9,68.8-68.8 C694.9,955,664,924.1,626.1,924.1z"/><path d="M1073.9,1109.7c-64.4,0-116.8-52.4-116.8-116.8s52.4-116.8,116.8-116.8s116.8,52.4,116.8,116.8 S1138.3,1109.7,1073.9,1109.7z M1073.9,924.1c-37.9,0-68.8,30.9-68.8,68.8s30.9,68.8,68.8,68.8s68.8-30.9,68.8-68.8 C1142.7,955,1111.8,924.1,1073.9,924.1z"/><path d="M850,1316c-56.1,0-112.2-13.5-162.3-39c-11.8-6-16.5-20.5-10.5-32.3s20.5-16.5,32.3-10.5c88,44.8,193,44.8,280.9,0 c11.8-6,26.3-1.3,32.3,10.5c6,11.8,1.3,26.3-10.5,32.3C962.2,1302.5,906.1,1316,850,1316z"/><path d="M1063.3,688H636.7c-13.3,0-24-10.7-24-24v-91.5c0-49.3,40.1-89.4,89.4-89.4h295.8c49.3,0,89.4,40.1,89.4,89.4V664 C1087.3,677.3,1076.6,688,1063.3,688z M660.7,640h378.7v-67.5c0-22.8-18.6-41.4-41.4-41.4H702.1c-22.8,0-41.4,18.6-41.4,41.4 L660.7,640L660.7,640z"/><path d="M850,531.1c-13.3,0-24-10.7-24-24V349.3c0-13.3,10.7-24,24-24s24,10.7,24,24V507C874,520.3,863.3,531.1,850,531.1z"/><path d="M1495.9,1115h-90.7c-13.3,0-24-10.7-24-24s10.7-24,24-24h90.7c40.9,0,74.1-33.2,74.1-74.1v-67.5c0-40-31.3-72.6-71.3-74 c-0.9,0-1.8-0.1-2.8-0.1h-108.2c-13.3,0-24-10.7-24-24s10.7-24,24-24h108.2c1.7,0,3.2,0,4.7,0.1c31.6,1.2,61.1,14.4,83.2,37.2 c22.1,22.9,34.3,53,34.3,84.8v67.5C1618,1060.2,1563.2,1115,1495.9,1115z"/><path d="M1499.6,851.4c-13.3,0-24-10.7-24-24v-5.8c0-252-150-478.3-382.1-576.5c-77.1-32.6-159-49.2-243.5-49.2 c-345,0-625.6,280.6-625.6,625.6v5.8c0,13.3-10.7,24-24,24s-24-10.7-24-24v-5.8c0-90.9,17.8-179.1,52.9-262.2 c33.9-80.2,82.5-152.3,144.4-214.1c61.9-61.9,133.9-110.4,214.1-144.3C670.9,165.8,759.1,148,850,148s179.2,17.8,262.2,52.9 c59.9,25.4,115.9,59.3,166.3,100.9c50,41.3,93.8,89.5,130.1,143.1c75.3,111.4,115.1,241.7,115.1,376.6v5.8 C1523.6,840.6,1512.9,851.4,1499.6,851.4z"/><path d="M294.8,1115h-90.7C136.8,1115,82,1060.2,82,992.9v-67.5c0-31.8,12.2-61.9,34.3-84.8c22-22.8,51.6-36,83.2-37.2 c1.4-0.1,2.9-0.1,4.6-0.1h108.2c13.3,0,24,10.7,24,24s-10.7,24-24,24H204.1c-1,0-1.9,0-2.7,0.1c-40.1,1.5-71.4,34-71.4,74.1V993 c0,40.9,33.2,74.1,74.1,74.1h90.7c13.3,0,24,10.7,24,24S308,1115,294.8,1115z"/></svg>';
  // Lucide "x"
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  // Lucide "send-horizontal"
  var SEND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg>';
  var teaserKey = 'nochbot_teaser_dismissed';

  /** Dark or white, whichever reads better on `hex` (WCAG relative luminance). */
  function inkOn(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#ffffff';
    var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return lum > 0.4 ? '#0b0f14' : '#ffffff';
  }

  /** The chat icon the organizer chose (an image served by us), or null for the built-in robot. */
  function launcherImageUrl() {
    return theme.launcherIconUrl ? normalizeUrl(theme.launcherIconUrl) : null;
  }

  function iconMarkup(url) {
    return url ? '<img class="nochbot-launcher-img" src="' + url.replace(/"/g, '%22') + '" alt="" draggable="false"/>' : BOT_ICON;
  }

  function buildWidget() {
    var iconUrl = launcherImageUrl();
    var root = document.createElement('div');
    root.id = 'nochbot-root';
    root.innerHTML = '<style>' + css() + '</style>' +
      '<div id="nochbot-teaser" role="status" hidden><p id="nochbot-teaser-text"></p>' +
      '<button id="nochbot-teaser-close" type="button" aria-label="Dismiss">' + CLOSE_ICON + '</button></div>' +
      '<button id="nochbot-toggle"' + (iconUrl ? ' class="has-icon"' : '') + ' type="button" aria-label="Open chat" aria-expanded="false" aria-controls="nochbot-panel">' +
      '<span class="nochbot-icon nochbot-icon-open">' + iconMarkup(iconUrl) + '</span>' +
      '<span class="nochbot-icon nochbot-icon-close">' + CLOSE_ICON + '</span>' +
      '</button>' +
      '<section id="nochbot-panel" role="dialog" aria-label="Chat assistant" aria-hidden="true">' +
      '<header id="nochbot-header"><span class="nochbot-avatar' + (iconUrl ? ' has-icon' : '') + '">' + iconMarkup(iconUrl) + '</span>' +
      '<div class="nochbot-title"><strong id="nochbot-name">Assistant</strong><span><i class="nochbot-online" aria-hidden="true"></i>Online</span></div>' +
      '<button id="nochbot-close" type="button" aria-label="Close chat">' + CLOSE_ICON + '</button></header>' +
      (testMode ? '<div id="nochbot-test-banner" role="note">TEST MODE: no real seats, emails or money</div>' : '') +
      '<div id="nochbot-messages" aria-label="Conversation"></div>' +
      '<div id="nochbot-live" class="nochbot-sr" role="status" aria-live="polite"></div>' +
      '<form id="nochbot-form"><input id="nochbot-input" autocomplete="off" enterkeyhint="send" aria-label="Message the assistant" placeholder="Type your message..."/>' +
      '<button id="nochbot-send" type="submit" aria-label="Send message">' + SEND_ICON + '</button></form>' +
      '</section>';
    document.body.appendChild(root);

    Array.prototype.forEach.call(root.querySelectorAll('.nochbot-launcher-img'), function (img) {
      img.addEventListener('error', function () {
        var holder = img.parentNode;
        if (!holder) return;
        holder.innerHTML = BOT_ICON;
        if (holder.classList.contains('nochbot-avatar')) holder.classList.remove('has-icon');
        var toggle = document.getElementById('nochbot-toggle');
        if (toggle) toggle.classList.remove('has-icon');
      });
    });

    document.getElementById('nochbot-toggle').addEventListener('click', function () { setOpen(!state.open); });
    document.getElementById('nochbot-close').addEventListener('click', function () { setOpen(false); });
    document.getElementById('nochbot-teaser-close').addEventListener('click', function (event) {
      event.stopPropagation();
      hideTeaser(true);
    });
    document.getElementById('nochbot-teaser-text').addEventListener('click', function () {
      var bookNow = !!state.teaserEventId && !state.bookingMode;
      setOpen(true);
      if (bookNow) {
        addMessage('user', 'Book tickets');
        startEmbedBooking();
      }
    });
    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.open) setOpen(false);
    });
    document.getElementById('nochbot-form').addEventListener('submit', function (event) {
      event.preventDefault();
      sendMessage();
    });
    setPanelInert(true);

    if (testMode) {
      startTestSession();
      if (autoOpen) setOpen(true);
    } else {
      greet();
    }
  }

  /** Closed panel stays in the DOM for the exit animation but is unreachable for keyboard and screen readers. */
  function setPanelInert(inert) {
    var panel = document.getElementById('nochbot-panel');
    if (!panel) return;
    panel.setAttribute('aria-hidden', inert ? 'true' : 'false');
    if ('inert' in panel) panel.inert = inert;
  }

  function setOpen(open) {
    state.open = open;
    var root = document.getElementById('nochbot-root');
    var toggle = document.getElementById('nochbot-toggle');
    if (root) root.classList.toggle('is-open', open);
    setPanelInert(!open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    }
    if (open) {
      hideTeaser(true);
      var list = document.getElementById('nochbot-messages');
      if (list) list.scrollTop = list.scrollHeight;
      setTimeout(function () {
        var input = document.getElementById('nochbot-input');
        if (input) input.focus();
      }, 60);
    } else if (toggle) {
      toggle.focus();
    }
  }

  /** "Hi! I can help…" beside the launcher, once per browser session, until the chat is opened or dismissed. */
  function showTeaser(text) {
    var dismissed = false;
    try { dismissed = sessionStorage.getItem(teaserKey) === '1'; } catch (e) { /* storage unavailable */ }
    if (dismissed || state.open || !text) return;
    var teaser = document.getElementById('nochbot-teaser');
    var label = document.getElementById('nochbot-teaser-text');
    if (!teaser || !label) return;
    label.textContent = text;
    setTimeout(function () {
      if (state.open) return;
      teaser.hidden = false;
      requestAnimationFrame(function () { teaser.classList.add('is-visible'); });
    }, 1500);
  }

  function hideTeaser(remember) {
    var teaser = document.getElementById('nochbot-teaser');
    if (teaser && !teaser.hidden) {
      teaser.classList.remove('is-visible');
      setTimeout(function () { teaser.hidden = true; }, 200);
    }
    if (remember) {
      try { sessionStorage.setItem(teaserKey, '1'); } catch (e) { /* storage unavailable */ }
    }
  }

  function setAssistantName(siteName) {
    var name = document.getElementById('nochbot-name');
    if (name && siteName && siteName !== 'this website') name.textContent = siteName + ' Assistant';
  }

  function loadTheme() {
    if (!userId) return Promise.resolve();
    return request('/api/theme?userId=' + encodeURIComponent(userId), { method: 'GET' })
      .then(function (data) {
        if (data.theme) {
          theme = Object.assign(theme, data.theme);
        } else if (window.console) {
          console.info('[NochBot] No theme saved for this assistant, using the default colours (Dashboard → Configure → Save Theme).');
        }
      }).catch(function () {
        if (window.console) console.warn('[NochBot] Could not load the assistant theme, using the default colours.');
      });
  }

  function css() {
    var bubbleInk = inkOn(theme.bubbleColor);
    var headerInk = inkOn(theme.headerColor);
    var userInk = inkOn(theme.userMsgColor);
    var sendInk = inkOn(theme.sendBtnColor);
    // Buttons that do something (Book tickets, Pay, Download), their hover and the input focus all use the chat bubble's
    // colour: the chatbot's main colour, as detected and set in Dashboard -> Configure.
    var actionColor = theme.bubbleColor || theme.sendBtnColor;
    var actionInk = inkOn(actionColor);
    var windowBg = theme.windowBgColor || '#f6f7f9';
    var ease = 'cubic-bezier(.16,1,.3,1)';
    return '#nochbot-root{position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;line-height:1.4}' +
      '#nochbot-root *{box-sizing:border-box}' +
      // A chosen icon is full-colour artwork with its own background, so it replaces the coloured disc; the X shown while open keeps one.
      '#nochbot-toggle.has-icon{background:transparent;box-shadow:none;overflow:visible;filter:drop-shadow(0 8px 18px rgba(0,0,0,.28))}' +
      '#nochbot-toggle.has-icon:hover{box-shadow:none}' +
      '.nochbot-launcher-img{width:100%;height:100%;object-fit:contain;display:block;user-select:none}' +
      '#nochbot-toggle.has-icon .nochbot-icon-close{background:' + theme.bubbleColor + ';color:' + bubbleInk + ';border-radius:999px}' +
      '.nochbot-avatar.has-icon{background:transparent;padding:0;overflow:hidden}.nochbot-avatar.has-icon img{border-radius:12px}' +
      '#nochbot-test-banner{background:#b91c1c;color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-align:center;padding:6px 10px}' +
      // Launcher
      '#nochbot-toggle{position:relative;width:60px;height:60px;border:0;border-radius:999px;background:' + theme.bubbleColor + ';color:' + bubbleInk + ';box-shadow:0 10px 30px rgba(0,0,0,.22),0 2px 6px rgba(0,0,0,.12);cursor:pointer;display:grid;place-items:center;transition:transform .2s ' + ease + ',box-shadow .2s ' + ease + '}' +
      '#nochbot-toggle:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 14px 36px rgba(0,0,0,.26),0 3px 8px rgba(0,0,0,.14)}' +
      '#nochbot-toggle:active{transform:scale(.96)}' +
      '.nochbot-icon{position:absolute;inset:0;display:grid;place-items:center;transition:opacity .2s ' + ease + ',transform .3s ' + ease + '}' +
      '.nochbot-icon-open svg{width:34px;height:34px}.nochbot-icon-close svg{width:24px;height:24px}' +
      '.nochbot-icon-close{opacity:0;transform:rotate(-90deg) scale(.6)}' +
      '#nochbot-root.is-open .nochbot-icon-open{opacity:0;transform:rotate(90deg) scale(.6)}' +
      '#nochbot-root.is-open .nochbot-icon-close{opacity:1;transform:none}' +
      // Teaser
      '#nochbot-teaser{position:absolute;right:0;bottom:74px;width:max-content;max-width:min(280px,calc(100vw - 40px));display:flex;align-items:flex-start;gap:6px;background:#fff;color:#111827;border:1px solid rgba(17,24,39,.08);border-radius:14px 14px 4px 14px;padding:10px 8px 10px 14px;box-shadow:0 12px 32px rgba(0,0,0,.16);opacity:0;transform:translateY(8px) scale(.96);transform-origin:bottom right;transition:opacity .25s ' + ease + ',transform .3s ' + ease + '}' +
      '#nochbot-teaser.is-visible{opacity:1;transform:none}#nochbot-teaser[hidden]{display:none}' +
      '#nochbot-teaser p{margin:0;font-size:14px;cursor:pointer}' +
      '#nochbot-teaser-close{flex-shrink:0;width:24px;height:24px;border:0;background:transparent;color:#6b7280;border-radius:999px;cursor:pointer;display:grid;place-items:center;padding:0}' +
      '#nochbot-teaser-close:hover{background:#f3f4f6;color:#111827}#nochbot-teaser-close svg{width:14px;height:14px}' +
      // Panel: always rendered, animated in and out
      '#nochbot-panel{position:absolute;right:0;bottom:76px;width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 116px));background:#fff;border:1px solid rgba(17,24,39,.1);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden;display:flex;flex-direction:column;' +
      'transform-origin:bottom right;opacity:0;transform:translateY(12px) scale(.96);visibility:hidden;pointer-events:none;' +
      'transition:opacity .16s ease-in,transform .16s ease-in,visibility 0s linear .16s}' +
      '#nochbot-root.is-open #nochbot-panel{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .24s ' + ease + ',transform .24s ' + ease + ',visibility 0s}' +
      // Header
      '#nochbot-header{background:' + theme.headerColor + ';color:' + headerInk + ';padding:14px 14px 14px 16px;display:flex;align-items:center;gap:12px}' +
      '.nochbot-avatar{width:38px;height:38px;flex-shrink:0;border-radius:12px;display:grid;place-items:center;background:' + (headerInk === '#ffffff' ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.08)') + '}' +
      '.nochbot-avatar svg{width:26px;height:26px}' +
      '.nochbot-title{flex:1;min-width:0}' +
      '.nochbot-title strong{display:block;font-size:15px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.nochbot-title span{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.78;margin-top:3px}' +
      '.nochbot-online{width:7px;height:7px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.25)}' +
      '#nochbot-close{border:0;background:' + (headerInk === '#ffffff' ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)') + ';color:' + headerInk + ';width:36px;height:36px;border-radius:999px;cursor:pointer;display:grid;place-items:center;flex-shrink:0;transition:background .15s ease}' +
      '#nochbot-close:hover{background:' + (headerInk === '#ffffff' ? 'rgba(255,255,255,.24)' : 'rgba(0,0,0,.14)') + '}' +
      '#nochbot-close svg{width:18px;height:18px}' +
      // Messages
      '#nochbot-messages{flex:1;overflow:auto;padding:16px;background:' + windowBg + ';display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}' +
      '.nochbot-message-row{display:flex;flex-direction:column;gap:8px}.nochbot-message-row.is-user{align-items:flex-end}.nochbot-message-row.is-bot{align-items:flex-start}' +
      '.nochbot-message-row.is-new{animation:nochbot-in .22s ' + ease + ' both}' +
      '@keyframes nochbot-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
      '.nochbot-message{max-width:82%;padding:10px 12px;border-radius:16px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}' +
      '.nochbot-message.is-bot{white-space:normal}.nochbot-message p{margin:0}.nochbot-message p+p,.nochbot-message p+.nochbot-list,.nochbot-message .nochbot-list+p{margin-top:8px}' +
      '.nochbot-list{margin:6px 0 0;padding-left:20px}.nochbot-list li{margin:4px 0;padding-left:2px}.nochbot-list li::marker{color:#6b7280}.nochbot-message strong{font-weight:650}' +
      '.nochbot-caret{display:inline-block;width:2px;height:1em;margin-left:2px;vertical-align:-2px;background:currentColor;animation:nochbot-blink .8s steps(1) infinite}@keyframes nochbot-blink{50%{opacity:0}}' +
      '.nochbot-message.is-user{background:' + theme.userMsgColor + ';color:' + userInk + ';border-bottom-right-radius:5px}.nochbot-message.is-bot{background:#fff;color:#111827;border:1px solid rgba(17,24,39,.08);border-bottom-left-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,.04)}' +
      '.nochbot-note{display:block;font-size:12px;color:#6b7280;margin-top:4px}' +
      '.nochbot-actions{display:flex;flex-wrap:wrap;gap:8px;max-width:82%}.nochbot-action,.nochbot-pay-link{border:1px solid rgba(17,24,39,.12);background:#fff;color:#111827;border-radius:999px;padding:8px 12px;font-size:13px;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}' +
      '.nochbot-action:hover{border-color:' + actionColor + '}' +
      '.nochbot-pay-link,.nochbot-action.is-primary{background:' + actionColor + ';color:' + actionInk + ';border:0;font-weight:700}' +
      // Composer
      '#nochbot-form{display:flex;align-items:center;gap:8px;padding:12px;border-top:1px solid rgba(17,24,39,.08);background:#fff}' +
      '#nochbot-input{flex:1;min-width:0;min-height:44px;border:1px solid rgba(17,24,39,.14);border-radius:999px;padding:10px 16px;font-size:16px;outline:none;background:#fff;color:#111827;transition:border-color .15s ease,box-shadow .15s ease}' +
      '#nochbot-input:focus{border-color:' + actionColor + ';box-shadow:0 0 0 3px rgba(17,24,39,.08)}' +
      '#nochbot-send{width:44px;height:44px;flex-shrink:0;border:0;border-radius:999px;background:' + theme.sendBtnColor + ';color:' + sendInk + ';cursor:pointer;display:grid;place-items:center;transition:transform .15s ease,opacity .15s ease}' +
      '#nochbot-send svg{width:20px;height:20px}#nochbot-send:hover:not(:disabled){transform:scale(1.05)}' +
      '#nochbot-send:disabled{opacity:.5;cursor:not-allowed}#nochbot-input[readonly]{background:#f9fafb}' +
      '#nochbot-root button:focus-visible,#nochbot-root a:focus-visible{outline:2px solid #111827;outline-offset:2px}' +
      '#nochbot-header button:focus-visible{outline-color:' + headerInk + '}' +
      '.nochbot-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}' +
      '@media(pointer:coarse){.nochbot-action,.nochbot-pay-link{min-height:44px;display:inline-flex;align-items:center}}' +
      '.nochbot-dot{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:999px;background:#9ca3af;animation:nochbot-pulse 1.2s infinite ease-in-out}.nochbot-dot:nth-child(2){animation-delay:.15s}.nochbot-dot:nth-child(3){animation-delay:.3s}' +
      '@keyframes nochbot-pulse{0%,80%,100%{opacity:.35}40%{opacity:1}}' +
      '@media(prefers-reduced-motion:reduce){#nochbot-panel,#nochbot-root.is-open #nochbot-panel,#nochbot-teaser,.nochbot-icon{transform:none!important;transition:opacity .15s ease,visibility 0s linear .15s!important}' +
      '#nochbot-root.is-open #nochbot-panel{transition:opacity .15s ease,visibility 0s!important}.nochbot-message-row.is-new{animation:none}.nochbot-dot{animation:none;opacity:.6}#nochbot-toggle:hover{transform:none}}' +
      '@media(max-width:480px){#nochbot-root{right:12px;bottom:12px}#nochbot-panel{width:calc(100vw - 24px);height:calc(100vh - 96px);height:calc(100dvh - 96px);border-radius:16px}}';
  }

  loadTheme().finally(buildWidget);
})();
