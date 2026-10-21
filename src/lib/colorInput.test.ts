import { describe, it, expect, vi } from "vitest";
import { createDebouncer, createFrameThrottle, normalizeHex } from "@/lib/colorInput";

describe("normalizeHex", () => {
  it("uppercases and keeps a full hex colour", () => {
    expect(normalizeHex("#facc15")).toBe("#FACC15");
    expect(normalizeHex("#FACC15")).toBe("#FACC15");
  });

  it("accepts a missing # and surrounding spaces", () => {
    expect(normalizeHex("facc15")).toBe("#FACC15");
    expect(normalizeHex("  #0f172a ")).toBe("#0F172A");
  });

  it("expands the three-digit form", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("f00")).toBe("#FF0000");
  });

  it("drops the alpha part of an eight-digit colour, which the API would reject", () => {
    expect(normalizeHex("#facc1580")).toBe("#FACC15");
  });

  it("rejects anything that is not a colour", () => {
    for (const bad of ["", "#", "#12", "#12345", "#1234567", "#gggggg", "red", "rgb(0,0,0)", "#fff;x", "javascript:1"]) {
      expect(normalizeHex(bad), bad).toBeNull();
    }
  });
});

describe("createFrameThrottle", () => {
  const manual = () => {
    const queue: Array<() => void> = [];
    return {
      schedule: (cb: () => void) => {
        queue.push(cb);
        return queue.length;
      },
      cancel: vi.fn(),
      frame: () => {
        const run = queue.splice(0);
        run.forEach((cb) => cb());
      },
      queued: () => queue.length,
    };
  };

  it("delivers only the newest value once per frame", () => {
    const frames = manual();
    const deliver = vi.fn();
    const throttle = createFrameThrottle<string>(deliver, frames.schedule, frames.cancel);
    throttle.push("#111111");
    throttle.push("#222222");
    throttle.push("#333333");
    expect(deliver).not.toHaveBeenCalled();
    expect(frames.queued()).toBe(1);
    frames.frame();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith("#333333");
  });

  it("schedules a new frame after one has run", () => {
    const frames = manual();
    const deliver = vi.fn();
    const throttle = createFrameThrottle<number>(deliver, frames.schedule, frames.cancel);
    throttle.push(1);
    frames.frame();
    throttle.push(2);
    frames.frame();
    expect(deliver.mock.calls).toEqual([[1], [2]]);
  });

  it("flush delivers a waiting value immediately and nothing twice", () => {
    const frames = manual();
    const deliver = vi.fn();
    const throttle = createFrameThrottle<string>(deliver, frames.schedule, frames.cancel);
    throttle.push("#ABCDEF");
    throttle.flush();
    expect(deliver).toHaveBeenCalledWith("#ABCDEF");
    frames.frame();
    expect(deliver).toHaveBeenCalledTimes(1);
    throttle.flush();
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("cancel drops a waiting value", () => {
    const frames = manual();
    const deliver = vi.fn();
    const throttle = createFrameThrottle<string>(deliver, frames.schedule, frames.cancel);
    throttle.push("#ABCDEF");
    throttle.cancel();
    frames.frame();
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("createDebouncer", () => {
  it("runs once, after the last call", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const debounce = createDebouncer(action, 400);
    debounce.call();
    vi.advanceTimersByTime(300);
    debounce.call();
    vi.advanceTimersByTime(300);
    expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(action).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("reports whether a run is waiting", () => {
    vi.useFakeTimers();
    const debounce = createDebouncer(() => {}, 400);
    expect(debounce.pending).toBe(false);
    debounce.call();
    expect(debounce.pending).toBe(true);
    vi.advanceTimersByTime(400);
    expect(debounce.pending).toBe(false);
    vi.useRealTimers();
  });

  it("flush runs a waiting action now, once, and does nothing when idle", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const debounce = createDebouncer(action, 400);
    debounce.flush();
    expect(action).not.toHaveBeenCalled();
    debounce.call();
    debounce.flush();
    expect(action).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(action).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("cancel drops a waiting action", () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const debounce = createDebouncer(action, 400);
    debounce.call();
    debounce.cancel();
    vi.advanceTimersByTime(1000);
    expect(action).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
