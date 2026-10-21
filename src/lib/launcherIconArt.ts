import { contrastRatio } from './ticketTemplates';
import { normalizeHex } from './colorInput';

/**
 * The chat icons as colour templates, so they take the chatbot's theme colour instead of always being orange.
 *
 * Each template is the artwork in `public/` with its colours replaced by tokens. Rendering with {@link ORIGINAL_PALETTE}
 * gives the original files back exactly (a test checks this), and rendering with a palette made from the theme's bubble
 * colour gives the same drawing in that colour, with glyphs chosen so they stay readable on it.
 *
 * Strings only, so it works anywhere (a deployed function cannot rely on reading files from `public/`).
 */

export type IconPalette = {
  /** The main colour. */
  base: string;
  light: string;
  lighter: string;
  glow: string;
  dark: string;
  deep: string;
  end: string;
  /** Glyphs drawn on the colour (white originally). */
  glyph: string;
  /** Marks drawn on the main colour, like the smile's face (near-black originally). */
  face: string;
  /** A mark drawn on top of the glyph colour, like the "N" inside the bubble. */
  mark: string;
  /** The main colour as used on a white background. */
  onWhite: string;
};

export const ORIGINAL_PALETTE: IconPalette = {
  base: '#FF5701',
  light: '#FF7A33',
  lighter: '#FFB15C',
  glow: '#FFA066',
  dark: '#E64A00',
  deep: '#B83D00',
  end: '#C2185B',
  glyph: '#fff',
  face: '#111',
  mark: '#FF5701',
  onWhite: '#FF5701',
};

export const ICON_TEMPLATES: Record<string, string> = {
  typing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#fff" stroke="{{onWhite}}" stroke-width="4"/>
  <path d="M21 22h22a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H31l-7 6v-6h-3a5 5 0 0 1-5-5V27a5 5 0 0 1 5-5z" fill="none" stroke="{{onWhite}}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="26" cy="32" r="2" fill="{{onWhite}}"/><circle cx="32" cy="32" r="2" fill="{{onWhite}}"/><circle cx="38" cy="32" r="2" fill="{{onWhite}}"/>
</svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{{lighter}}"/><stop offset=".5" stop-color="{{base}}"/><stop offset="1" stop-color="{{end}}"/>
  </linearGradient></defs>
  <circle cx="32" cy="32" r="32" fill="url(#s)"/>
  <path d="M28 16l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="{{glyph}}"/>
  <path d="M42 34l1.8 5.2L49 41l-5.2 1.8L42 48l-1.8-5.2L35 41l5.2-1.8z" fill="{{glyph}}" fill-opacity=".9"/>
  <circle cx="44" cy="20" r="2.2" fill="{{glyph}}" fill-opacity=".8"/>
</svg>`,
  nochat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{light}}"/><stop offset="1" stop-color="{{dark}}"/></linearGradient></defs>
  <circle cx="32" cy="32" r="32" fill="url(#g)"/>
  <path d="M18 18h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H30l-8 7v-7h-4a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z" fill="{{glyph}}"/>
  <path d="M24.5 38V24h3.6l8.4 9.2V24h3.5v14h-3.5l-8.5-9.3V38z" fill="{{mark}}"/>
</svg>`,
  smile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="20" fill="#111"/>
  <rect x="2" y="2" width="60" height="60" rx="18" fill="none" stroke="{{base}}" stroke-opacity=".35" stroke-width="1.5"/>
  <path d="M19 20h26a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H35l-9 7v-7h-7a5 5 0 0 1-5-5V25a5 5 0 0 1 5-5z" fill="{{base}}"/>
  <path d="M25 34q7 5 14 0" fill="none" stroke="{{face}}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="26" cy="28" r="2.2" fill="{{face}}"/><circle cx="38" cy="28" r="2.2" fill="{{face}}"/>
</svg>`,
  voice: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{{light}}"/><stop offset="1" stop-color="{{dark}}"/></linearGradient></defs>
  <circle cx="32" cy="32" r="32" fill="url(#g)"/>
  <g fill="{{glyph}}">
    <rect x="17" y="28" width="4" height="8" rx="2"/>
    <rect x="24" y="22" width="4" height="20" rx="2"/>
    <rect x="31" y="16" width="4" height="32" rx="2"/>
    <rect x="38" y="22" width="4" height="20" rx="2"/>
    <rect x="45" y="28" width="4" height="8" rx="2"/>
  </g>
</svg>`,
  orb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs><radialGradient id="o" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="{{glow}}"/><stop offset=".6" stop-color="{{base}}"/><stop offset="1" stop-color="{{deep}}"/>
  </radialGradient></defs>
  <circle cx="32" cy="32" r="32" fill="url(#o)"/>
  <ellipse cx="25" cy="30" rx="3.5" ry="5.5" fill="{{glyph}}"/>
  <ellipse cx="39" cy="30" rx="3.5" ry="5.5" fill="{{glyph}}"/>
  <path d="M26 41q6 4 12 0" fill="none" stroke="{{glyph}}" stroke-width="3" stroke-linecap="round"/>
</svg>`,
};

// ── Colour maths ────────────────────────────────────────────────────────────────────────────────────────

const WHITE = '#FFFFFF';
const BLACK = '#000000';
const DARK_INK = '#111827';

const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** `amount` of `towards` mixed into `hex` (0 keeps it, 1 is all `towards`). */
export function mix(hex: string, towards: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(towards);
  return toHex(a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount);
}

/** Darkens a colour until it keeps at least `min` contrast against white. */
function darkenForWhite(hex: string, min: number): string {
  let color = hex;
  for (let i = 0; i < 24 && contrastRatio(color, WHITE) < min; i++) color = mix(color, BLACK, 0.08);
  return color;
}

/** The palette for a theme colour, or the original orange when there is no usable colour. */
export function paletteFor(color: string | null | undefined): IconPalette {
  const base = color ? normalizeHex(color) : null;
  if (!base) return ORIGINAL_PALETTE;

  const whiteGlyph = contrastRatio(WHITE, base) >= 2.5;
  const glyph = whiteGlyph ? '#FFFFFF' : DARK_INK;
  const onWhite = darkenForWhite(base, 3);

  return {
    base,
    light: mix(base, WHITE, 0.22),
    lighter: mix(base, WHITE, 0.5),
    glow: mix(base, WHITE, 0.4),
    dark: mix(base, BLACK, 0.1),
    deep: mix(base, BLACK, 0.28),
    end: mix(base, BLACK, 0.4),
    glyph,
    face: contrastRatio('#111111', base) >= 3 ? '#111111' : '#FFFFFF',
    // On a white glyph the mark is the main colour darkened to stay readable; on a dark glyph the main colour itself shows.
    mark: whiteGlyph ? onWhite : base,
    onWhite,
  };
}

/** The icon's SVG in the given theme colour; the original artwork for no or an invalid colour; null for an unknown icon. */
export function renderLauncherIcon(id: string, color?: string | null): string | null {
  if (!Object.prototype.hasOwnProperty.call(ICON_TEMPLATES, id)) return null;
  const palette = paletteFor(color);
  return ICON_TEMPLATES[id].replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = (palette as Record<string, string>)[key];
    if (value === undefined) throw new Error(`Unknown icon colour token: ${key}`);
    return value;
  });
}
