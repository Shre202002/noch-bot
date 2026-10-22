/**
 * The beep and buzz at the door, so staff do not have to look at the screen. Browsers only allow sound after the person
 * has touched the page, so `armSound()` is called from the first tap; until then results are silent (vibration still works).
 */

let audio: AudioContext | null = null;

export function armSound(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio = audio ?? new Ctor();
    void audio.resume();
  } catch {
    /* no audio on this device */
  }
}

function tone(frequency: number, start: number, length: number, volume = 0.18): void {
  if (!audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  const at = audio.currentTime + start;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.01);
  gain.gain.linearRampToValueAtTime(0, at + length);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(at);
  oscillator.stop(at + length + 0.02);
}

/** A short high beep when someone is admitted; a low double buzz when they are not. */
export function signalResult(good: boolean): void {
  try {
    if (good) {
      tone(1320, 0, 0.11);
      navigator.vibrate?.(70);
    } else {
      tone(220, 0, 0.14, 0.22);
      tone(220, 0.2, 0.14, 0.22);
      navigator.vibrate?.([80, 60, 80]);
    }
  } catch {
    /* sound and vibration are extras */
  }
}
