import type { TicketColorPalette } from '@/models/Event';

/**
 * The ticket designs an organizer can choose from. One list drives the picker, the live preview and the ticket page,
 * and the API checks a chosen id against it, so a design can never be saved that nothing can draw.
 */

/** How the design is laid out; the picker draws a small thumbnail of it. */
export type TicketThumb = 'split' | 'pass' | 'centered' | 'vintage' | 'neon' | 'gradient' | 'stub' | 'badge' | 'receipt';

export type TicketTemplate = {
  id: string;
  name: string;
  description: string;
  thumb: TicketThumb;
  palette: TicketColorPalette;
  /** Added after the first four designs; the picker marks these. */
  isNew?: boolean;
};

export const TICKET_TEMPLATES: TicketTemplate[] = [
  {
    id: 'modern',
    name: 'Bold Graphic',
    description: 'Big colour block with a clean QR panel',
    thumb: 'split',
    palette: { background_color: '#2563eb', text_color: '#ffffff', accent_color: '#ffffff', border_color: '#3b82f6', muted_text_color: '#bfdbfe', qr_background_color: '#ffffff' },
  },
  {
    id: 'minimal',
    name: 'Boarding Pass',
    description: 'Light, tidy, with a tear-off QR side',
    thumb: 'pass',
    palette: { background_color: '#ffffff', text_color: '#0f172a', accent_color: '#10b981', border_color: '#e2e8f0', muted_text_color: '#64748b', qr_background_color: '#ffffff' },
  },
  {
    id: 'dark',
    name: 'Premium Dark',
    description: 'Dark card with gold framing',
    thumb: 'centered',
    palette: { background_color: '#0c0c1d', text_color: '#ffffff', accent_color: '#d4af37', border_color: '#1e1e3f', muted_text_color: '#6b6b65', qr_background_color: '#ffffff' },
  },
  {
    id: 'classic',
    name: 'Vintage Raffle',
    description: 'Warm paper look with a serif title',
    thumb: 'vintage',
    palette: { background_color: '#fcf9f2', text_color: '#433322', accent_color: '#ccbb99', border_color: '#ddccaa', muted_text_color: '#73726c', qr_background_color: '#ffffff' },
  },
  {
    id: 'neon',
    name: 'Neon Night',
    description: 'Glowing edges for gigs and club nights',
    thumb: 'neon',
    isNew: true,
    palette: { background_color: '#0b0720', text_color: '#f5f3ff', accent_color: '#22d3ee', border_color: '#a855f7', muted_text_color: '#c4b5fd', qr_background_color: '#ffffff' },
  },
  {
    id: 'sunset',
    name: 'Sunset Gradient',
    description: 'Warm gradient for festivals and parties',
    thumb: 'gradient',
    isNew: true,
    palette: { background_color: '#9d174d', text_color: '#ffffff', accent_color: '#ea580c', border_color: '#fda4af', muted_text_color: '#fed7aa', qr_background_color: '#ffffff' },
  },
  {
    id: 'festival',
    name: 'Festival Stub',
    description: 'Loud, high-contrast ticket with a tear-off stub',
    thumb: 'stub',
    isNew: true,
    palette: { background_color: '#facc15', text_color: '#111111', accent_color: '#111111', border_color: '#111111', muted_text_color: '#713f12', qr_background_color: '#ffffff' },
  },
  {
    id: 'badge',
    name: 'Conference Badge',
    description: 'Upright name badge for talks and workshops',
    thumb: 'badge',
    isNew: true,
    palette: { background_color: '#ffffff', text_color: '#0f172a', accent_color: '#0369a1', border_color: '#cbd5e1', muted_text_color: '#475569', qr_background_color: '#ffffff' },
  },
  {
    id: 'receipt',
    name: 'Mono Receipt',
    description: 'Typewriter style, like a printed receipt',
    thumb: 'receipt',
    isNew: true,
    palette: { background_color: '#f8fafc', text_color: '#111827', accent_color: '#111827', border_color: '#9ca3af', muted_text_color: '#4b5563', qr_background_color: '#ffffff' },
  },
];

export const TICKET_TEMPLATE_DEFAULT_PALETTES: Record<string, TicketColorPalette> = Object.fromEntries(
  TICKET_TEMPLATES.map((t) => [t.id, t.palette])
);

/** Ids drawn by the shared TicketFace component (the four originals keep their own renderers). */
export const FACE_TEMPLATE_IDS = ['neon', 'sunset', 'festival', 'badge', 'receipt'] as const;
export type FaceTemplateId = (typeof FACE_TEMPLATE_IDS)[number];

export const isFaceTemplate = (id: string): id is FaceTemplateId => (FACE_TEMPLATE_IDS as readonly string[]).includes(id);

export const isKnownTemplate = (id: unknown): id is string =>
  typeof id === 'string' && TICKET_TEMPLATES.some((t) => t.id === id);

// ── Contrast ──────────────────────────────────────────────────────────────────

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

/** WCAG contrast ratio between two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
