/**
 * Small, framework-free helpers behind the ticket colour fields: reading what someone typed, and spacing out the
 * updates a colour drag produces so the page redraws once per frame and saves once per gesture.
 */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * A colour as the ticket design API stores it: uppercase `#RRGGBB`, or null when the text is not a colour.
 * Accepts `#rgb`, `#rrggbb` and `#rrggbbaa` (the alpha part is dropped), with or without the `#`.
 */
export function normalizeHex(input: string): string | null {
  const match = HEX.exec(input.trim());
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) digits = digits.split('').map((c) => c + c).join('');
  return `#${digits.slice(0, 6).toUpperCase()}`;
}

type Schedule = (callback: () => void) => unknown;
type Cancel = (handle: unknown) => void;

/**
 * Passes on only the newest value once per animation frame. A drag can produce many values per frame; the page
 * only needs the latest one to draw. `flush` delivers a waiting value right away (used when the drag ends).
 */
export function createFrameThrottle<T>(
  deliver: (value: T) => void,
  schedule: Schedule = (cb) => requestAnimationFrame(cb),
  cancel: Cancel = (h) => cancelAnimationFrame(h as number)
) {
  let waiting: { value: T } | null = null;
  let handle: unknown = null;

  const run = () => {
    handle = null;
    if (!waiting) return;
    const { value } = waiting;
    waiting = null;
    deliver(value);
  };

  return {
    push(value: T) {
      waiting = { value };
      if (handle === null) handle = schedule(run);
    },
    flush() {
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      run();
    },
    cancel() {
      if (handle !== null) cancel(handle);
      handle = null;
      waiting = null;
    },
  };
}

/**
 * Runs `action` once, `ms` after the last `call`. `flush` runs it now if a call is waiting, so an edit is not lost
 * when the person leaves the screen.
 */
export function createDebouncer(action: () => void, ms: number, setTimer = setTimeout, clearTimer = clearTimeout) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = () => {
    timer = null;
    action();
  };

  return {
    call() {
      if (timer !== null) clearTimer(timer);
      timer = setTimer(fire, ms);
    },
    flush() {
      if (timer === null) return;
      clearTimer(timer);
      fire();
    },
    cancel() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    get pending() {
      return timer !== null;
    },
  };
}
