/**
 * Built-in emblems an organizer can use as the event logo when they have no logo of their own. They are small
 * stroke drawings on a 24 by 24 grid made for this app, so there are no third-party assets to license.
 *
 * Every ticket design already draws its logo from a URL in an <img>, so an emblem is turned into a small SVG data URL
 * and handed to the same slot: no ticket design needs to know emblems exist.
 */

export type EmblemGroup = 'Digital ticket' | 'Event types';

export type Emblem = {
  id: string;
  name: string;
  group: EmblemGroup;
  /** SVG path data, drawn as strokes. */
  paths: string[];
};

export const EMBLEM_GROUPS: EmblemGroup[] = ['Digital ticket', 'Event types'];

export const TICKET_EMBLEMS: Emblem[] = [
  {
    id: 'ticket',
    name: 'Ticket',
    group: 'Digital ticket',
    paths: [
      'M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5V10a2 2 0 0 0 0 4v1.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5V14a2 2 0 0 0 0-4z',
      'M14 7v2M14 11v2M14 15v2',
    ],
  },
  {
    id: 'eticket',
    name: 'E-ticket',
    group: 'Digital ticket',
    paths: [
      'M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z',
      'M10.5 19h3',
      'M9 8.5h6v2.2a1 1 0 0 0 0 1.6v2.2H9v-2.2a1 1 0 0 0 0-1.6z',
    ],
  },
  {
    id: 'qr',
    name: 'QR code',
    group: 'Digital ticket',
    paths: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z', 'M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z'],
  },
  {
    id: 'scan',
    name: 'Scan',
    group: 'Digital ticket',
    paths: [
      'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16',
      'M4 12h16',
    ],
  },
  {
    id: 'verified',
    name: 'Verified',
    group: 'Digital ticket',
    paths: ['M12 3l7 2.5V11c0 4.5-3 8-7 10-4-2-7-5.5-7-10V5.5z', 'M8.8 12l2.2 2.2 4.2-4.4'],
  },
  {
    id: 'wallet',
    name: 'Wallet',
    group: 'Digital ticket',
    paths: [
      'M4 7.5A1.5 1.5 0 0 1 5.5 6H18v3',
      'M4 7.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-8a1 1 0 0 0-1-1H5.5A1.5 1.5 0 0 1 4 7.5z',
      'M16 14.5h.01',
    ],
  },
  {
    id: 'music',
    name: 'Music',
    group: 'Event types',
    paths: ['M9 18V6l10-2v12', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  },
  {
    id: 'mic',
    name: 'Talk',
    group: 'Event types',
    paths: ['M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5V21M8.5 21h7'],
  },
  {
    id: 'trophy',
    name: 'Trophy',
    group: 'Event types',
    paths: [
      'M8 4h8v5a4 4 0 0 1-8 0z',
      'M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3',
      'M12 13v3.5M9.5 20v-1.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V20M8.5 20h7',
    ],
  },
  {
    id: 'star',
    name: 'Star',
    group: 'Event types',
    paths: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z'],
  },
  {
    id: 'graduation',
    name: 'Graduation',
    group: 'Event types',
    paths: ['M2.5 9.5L12 5l9.5 4.5L12 14z', 'M6.5 11.5v4.2c0 1 2.5 2.8 5.5 2.8s5.5-1.8 5.5-2.8v-4.2', 'M21.5 9.5V14'],
  },
  {
    id: 'code',
    name: 'Tech',
    group: 'Event types',
    paths: ['M8.5 7l-5 5 5 5M15.5 7l5 5-5 5', 'M13.5 5l-3 14'],
  },
  {
    id: 'camera',
    name: 'Photo',
    group: 'Event types',
    paths: [
      'M4 8h3l1.5-2.5h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z',
      'M12 11a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
    ],
  },
  {
    id: 'cheers',
    name: 'Party',
    group: 'Event types',
    paths: ['M5 4h6l-.8 6a2.2 2.2 0 0 1-4.4 0zM8 12v6M5.5 20h5', 'M13 4h6l-.8 6a2.2 2.2 0 0 1-4.4 0zM16 12v6M13.5 20h5'],
  },
];

export const isKnownEmblem = (id: unknown): id is string =>
  typeof id === 'string' && TICKET_EMBLEMS.some((e) => e.id === id);

const HEX = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_COLOR = '#111111';

/** The SVG markup for an emblem. The colour is used only when it is a plain `#rrggbb`, so it cannot carry markup. */
export function emblemSvg(id: string, color: string): string | null {
  const emblem = TICKET_EMBLEMS.find((e) => e.id === id);
  if (!emblem) return null;
  const stroke = HEX.test(color) ? color : FALLBACK_COLOR;
  const paths = emblem.paths.map((d) => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/** A data URL an <img> can show, or null for an unknown emblem. */
export function emblemDataUrl(id: string, color: string): string | null {
  const svg = emblemSvg(id, color);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}

type LogoSource = {
  logo_url?: string | null;
  remove_background?: boolean | null;
  bg_removed_logo_url?: string | null;
  logo_emblem?: string | null;
};

/**
 * The logo a ticket shows: an uploaded image wins (with its background removed when that is switched on), then the
 * chosen emblem drawn in the ticket's text colour (readable on every design's background), otherwise none.
 */
export function resolveTicketLogo(event: LogoSource, palette: { text_color: string }): string | null {
  if (event.logo_url) {
    return event.remove_background && event.bg_removed_logo_url ? event.bg_removed_logo_url : event.logo_url;
  }
  if (event.logo_emblem) return emblemDataUrl(event.logo_emblem, palette.text_color);
  return null;
}

// ── Saving the logo ────────────────────────────────────────────────────────────

export type LogoUpdates = { ok: true; updates: Record<string, unknown> } | { ok: false; error: string };

const has = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);

/**
 * The fields of a logo save, taken only from the keys the request actually sent. Switching background removal on or
 * off must not erase the uploaded logo, and choosing an emblem must not touch the upload fields.
 */
export function buildLogoUpdates(body: unknown): LogoUpdates {
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const updates: Record<string, unknown> = {};

  for (const key of ['logo_url', 'logo_file_id', 'bg_removed_logo_url'] as const) {
    if (has(input, key)) {
      const value = input[key];
      updates[key] = typeof value === 'string' && value ? value : null;
    }
  }
  if (has(input, 'remove_background')) updates.remove_background = !!input.remove_background;

  if (has(input, 'logo_emblem')) {
    const value = input.logo_emblem;
    if (value === null || value === '') updates.logo_emblem = null;
    else if (isKnownEmblem(value)) updates.logo_emblem = value;
    else return { ok: false, error: 'Unknown emblem' };
  }
  return { ok: true, updates };
}
