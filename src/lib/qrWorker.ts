/// <reference lib="webworker" />
import jsQR from 'jsqr';

/**
 * Decodes QR codes off the main thread, so the camera preview never stutters while a frame is being read.
 * Receives `{ id, width, height, buffer }` (RGBA pixels, transferred) and answers `{ id, data }` (the text, or '').
 */
self.onmessage = (event: MessageEvent<{ id: number; width: number; height: number; buffer: ArrayBuffer }>) => {
  const { id, width, height, buffer } = event.data;
  // Tickets are dark codes on a light background, so inverted codes are not tried: that halves the work per frame.
  const code = jsQR(new Uint8ClampedArray(buffer), width, height, { inversionAttempts: 'dontInvert' });
  (self as unknown as Worker).postMessage({ id, data: code?.data ?? '' });
};
