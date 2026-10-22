import { describe, expect, it } from "vitest";
import { centerCrop, createSameCodeLock } from "@/lib/qrScanner";

describe("centerCrop", () => {
  it("is the centre square of a landscape frame, drawn at most 480 px wide", () => {
    // 720 high: 80% = 576 px square, centred horizontally in 1280.
    expect(centerCrop(1280, 720)).toEqual({ sx: 352, sy: 72, sw: 576, sh: 576, dw: 480, dh: 480 });
  });

  it("keeps a small frame at its own size", () => {
    expect(centerCrop(320, 240)).toEqual({ sx: 64, sy: 24, sw: 192, sh: 192, dw: 192, dh: 192 });
  });

  it("works for a portrait frame, and never returns an empty box", () => {
    const portrait = centerCrop(720, 1280);
    expect(portrait.sx).toBe(72);
    expect(portrait.sy).toBe(352);
    expect(centerCrop(0, 0).sw).toBeGreaterThan(0);
  });
});

describe("createSameCodeLock", () => {
  it("acts on a code the first time, then ignores it while it stays in view", () => {
    const lock = createSameCodeLock(1500);
    expect(lock.accept("EVT-AAAAAAAA", 0)).toBe(true);
    expect(lock.accept("EVT-AAAAAAAA", 200)).toBe(false);
    // Still in view well past the release time: the lock keeps extending, so it is still ignored.
    expect(lock.accept("EVT-AAAAAAAA", 1500)).toBe(false);
    expect(lock.accept("EVT-AAAAAAAA", 2900)).toBe(false);
  });

  it("lets go once the code has been out of view for the release time", () => {
    const lock = createSameCodeLock(1500);
    lock.accept("EVT-AAAAAAAA", 0);
    expect(lock.accept("EVT-AAAAAAAA", 1600)).toBe(true);
  });

  it("acts on a different code straight away", () => {
    const lock = createSameCodeLock(1500);
    lock.accept("EVT-AAAAAAAA", 0);
    expect(lock.accept("EVT-BBBBBBBB", 50)).toBe(true);
    // ...and the first one counts as new again if it comes back after the second.
    expect(lock.accept("EVT-AAAAAAAA", 100)).toBe(true);
  });

  it("keeps a code locked while another is being checked (touch), but never starts acting on it", () => {
    const lock = createSameCodeLock(1500);
    lock.accept("EVT-AAAAAAAA", 0);
    lock.touch("EVT-AAAAAAAA", 1400);
    lock.touch("EVT-OTHER000", 1450); // an unrelated code does not change anything
    expect(lock.accept("EVT-AAAAAAAA", 2800)).toBe(false);
  });
});
