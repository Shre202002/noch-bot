'use client';

/**
 * @fileOverview Lightweight client-side analytics SDK for NochBot.
 * Handles visitor/session ID management and event reporting.
 */

const VISITOR_KEY = 'nb_visitor_id';
const SESSION_KEY = 'nb_session_id';
const CONSENT_KEY = 'nb_cookie_consent';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}

export async function trackEvent(event: string, metadata: Record<string, any> = {}) {
  if (!hasConsent() || typeof window === 'undefined') return;

  try {
    const payload = {
      event,
      page: window.location.pathname,
      sourceUrl: window.location.href,
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      metadata: {
        ...metadata,
        browser: navigator.userAgent,
        language: navigator.language,
        screen: `${window.screen.width}x${window.screen.height}`,
      },
    };

    // Use sendBeacon for more reliable fire-and-forget tracking
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/track', JSON.stringify(payload));
    } else {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {}); // Fail silently
    }
  } catch (err) {
    // Analytics failures should never break the main thread
  }
}
