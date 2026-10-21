import { normalizeHex } from './colorInput';

/**
 * The chat icons an organizer can choose for the website widget's launcher button.
 *
 * `default` is the built-in robot, which takes the bubble colour. The others are ready-made SVG files in `public/`;
 * they are full-colour artwork with their own background, so the widget shows them as images. The theme stores only
 * the id, and the file path always comes from this list, never from what was saved or sent.
 */

export type LauncherIcon = {
  id: string;
  name: string;
  /** File in `public/`, as a site-relative path; null for the built-in robot. */
  path: string | null;
};

export const DEFAULT_LAUNCHER_ICON = 'default';

export const LAUNCHER_ICONS: LauncherIcon[] = [
  { id: DEFAULT_LAUNCHER_ICON, name: 'Robot', path: null },
  { id: 'typing', name: 'Typing bubble', path: '/chat-icon-2.svg' },
  // chat-icon-3.svg is an identical copy of this file, so only one of them is offered.
  { id: 'sparkles', name: 'Sparkles', path: '/launcher-sparkles.svg' },
  { id: 'nochat', name: 'N chat', path: '/chat-icon-4.svg' },
  { id: 'smile', name: 'Smile', path: '/chat-icon-5.svg' },
  { id: 'voice', name: 'Voice bars', path: '/chat-icon-6.svg' },
  { id: 'orb', name: 'Orb', path: '/chat-icon-7.svg' },
];

export const isKnownLauncherIcon = (id: unknown): id is string =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(Object.fromEntries(LAUNCHER_ICONS.map((i) => [i.id, true])), id);

/** The image path for an icon id, or null for the built-in robot, an unknown id, or nothing chosen. */
export function launcherIconPath(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  return LAUNCHER_ICONS.find((i) => i.id === id)?.path ?? null;
}

/**
 * Where the widget and the picker load an icon from: our own endpoint, which draws it in the theme colour. Null for the
 * built-in robot or an unknown id. A missing or invalid colour gives the original artwork.
 */
export function launcherIconUrl(id: unknown, color?: string | null): string | null {
  if (launcherIconPath(id) === null) return null;
  const hex = color ? normalizeHex(color) : null;
  return `/api/launcher-icon/${id as string}${hex ? `?color=${hex.slice(1)}` : ''}`;
}
