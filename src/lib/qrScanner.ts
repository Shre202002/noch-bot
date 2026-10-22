/**
 * Fast QR reading for the ticket scanner page: the camera at 1280x720, every video frame examined, the browser's own
 * detector when it has one, and otherwise only the centre scanning box decoded by jsQR in a Web Worker. Browser only,
 * except the small pure helpers, which are unit tested.
 */

const MAX_DECODE_SIZE = 480; // longest side, in pixels, of the area handed to the decoder
const SCAN_BOX = 0.8; // share of the shorter video side that the on-screen scanning box covers
const FALLBACK_FRAME_MS = 60;

/** The centre square of the video that is decoded, and the size it is drawn at (never more than MAX_DECODE_SIZE). */
export function centerCrop(videoWidth: number, videoHeight: number, fraction = SCAN_BOX, maxSize = MAX_DECODE_SIZE) {
  const side = Math.max(1, Math.floor(Math.min(videoWidth, videoHeight) * fraction));
  const sx = Math.floor((videoWidth - side) / 2);
  const sy = Math.floor((videoHeight - side) / 2);
  const draw = Math.min(side, maxSize);
  return { sx, sy, sw: side, sh: side, dw: draw, dh: draw };
}

/**
 * Stops one ticket in front of the camera from being sent again and again. A code is acted on the first time it is seen;
 * while it stays in view the lock keeps extending, and it lets go `releaseMs` after the code was last seen. A different
 * code is acted on straight away.
 */
export function createSameCodeLock(releaseMs = 1500) {
  let code = '';
  let lastSeen = 0;
  return {
    /** True when `value` should be acted on now. */
    accept(value: string, now = Date.now()): boolean {
      if (value === code && now - lastSeen < releaseMs) {
        lastSeen = now;
        return false;
      }
      code = value;
      lastSeen = now;
      return true;
    },
    /** The code was seen while something else was being checked: keep its lock alive without acting on it. */
    touch(value: string, now = Date.now()) {
      if (value === code) lastSeen = now;
    },
  };
}

export type CameraHandle = {
  stream: MediaStream;
  /** True when this camera has a torch (flashlight) that can be switched. */
  torchSupported: boolean;
  /** Switches the light; true when the camera accepted it. */
  setTorch: (on: boolean) => Promise<boolean>;
};

/** Opens the rear camera at 720p and 30 fps with continuous autofocus where the browser allows it. */
export async function openCamera(): Promise<CameraHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: false,
  });
  const track = stream.getVideoTracks()[0];
  const capabilities = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
  if (track && capabilities.focusMode?.includes('continuous')) {
    // An extra, never required.
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
  }
  return {
    stream,
    torchSupported: Boolean(capabilities.torch),
    setTorch: async (on) => {
      try {
        await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
        return Boolean(track);
      } catch {
        return false;
      }
    },
  };
}

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };

/**
 * Reads QR codes from a playing video until the returned function is called. `onCode` gets the text of every code seen on
 * every frame it is visible (the caller decides what to do with repeats); one frame is decoded at a time.
 */
export function startQrReading(video: HTMLVideoElement, onCode: (text: string) => void): () => void {
  let stopped = false;
  let decoding = false;

  const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  const detector = Native ? new Native({ formats: ['qr_code'] }) : null;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  // The worker is only needed without the native detector. If it cannot start, decode on the main thread instead.
  let worker: Worker | null = null;
  const waiting = new Map<number, (text: string) => void>();
  let nextId = 0;
  let jsQROnMain: typeof import('jsqr').default | null = null;
  if (!detector) {
    try {
      worker = new Worker(new URL('./qrWorker.ts', import.meta.url));
      worker.onmessage = (event: MessageEvent<{ id: number; data: string }>) => {
        waiting.get(event.data.id)?.(event.data.data);
        waiting.delete(event.data.id);
      };
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        waiting.forEach((resolve) => resolve(''));
        waiting.clear();
      };
    } catch {
      worker = null;
    }
  }

  async function decode(): Promise<string> {
    if (detector) return (await detector.detect(video))[0]?.rawValue ?? '';
    if (!context || !video.videoWidth) return '';
    const crop = centerCrop(video.videoWidth, video.videoHeight);
    canvas.width = crop.dw;
    canvas.height = crop.dh;
    context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.dw, crop.dh);
    const image = context.getImageData(0, 0, crop.dw, crop.dh);
    if (worker) {
      const id = nextId++;
      return new Promise<string>((resolve) => {
        waiting.set(id, resolve);
        worker!.postMessage({ id, width: image.width, height: image.height, buffer: image.data.buffer }, [image.data.buffer]);
      });
    }
    jsQROnMain = jsQROnMain ?? (await import('jsqr')).default;
    return jsQROnMain(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? '';
  }

  const nextFrame = () => {
    if (stopped) return;
    if ('requestVideoFrameCallback' in video) (video as HTMLVideoElement).requestVideoFrameCallback(() => void tick());
    else setTimeout(() => void tick(), FALLBACK_FRAME_MS);
  };

  async function tick() {
    if (stopped) return;
    if (!decoding && video.readyState >= 2) {
      decoding = true;
      try {
        const text = await decode();
        if (text && !stopped) onCode(text);
      } catch {
        /* a frame that cannot be read is skipped */
      } finally {
        decoding = false;
      }
    }
    nextFrame();
  }

  nextFrame();
  return () => {
    stopped = true;
    worker?.terminate();
    waiting.clear();
  };
}
