/**
 * Runs public/embed.js for real against a tiny fake page, to check what a visitor sees beside the chat icon: the message,
 * when it appears, and when it stays away. Only the parts of the browser the widget touches are faked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

// EMBED_JS_PATH lets the same checks run against another copy of the widget (for example an older version).
const source = fs.readFileSync(process.env.EMBED_JS_PATH ?? path.join(process.cwd(), "public", "embed.js"), "utf8").replace(/^﻿/, "");
const DEFAULT = "I'm here to help you.";

type Handler = (event: Record<string, unknown>) => void;
type El = Record<string, any>;

function makeEnv(opts: {
  events?: Array<Record<string, unknown>>;
  teaser?: string;
  teaserEventId?: string | null;
  /** The greeting never arrives (the AI is slow): the bubble must not wait for it. */
  greetingNever?: boolean;
  session?: Map<string, string>;
  scriptAttrs?: Record<string, string>;
}) {
  const registry = new Map<string, El>();
  const fetched: string[] = [];
  const session = opts.session ?? new Map<string, string>();

  const created: El[] = [];
  const makeEl = (tag = "div", attrs = ""): El => {
    const listeners: Record<string, Handler[]> = {};
    const classes = new Set<string>();
    const target: El = {
      tagName: tag.toUpperCase(),
      id: "",
      hidden: /\bhidden\b/.test(attrs),
      textContent: "",
      className: "",
      children: [] as El[],
      style: {},
      dataset: {},
      listeners,
      classes,
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        toggle: (c: string, on?: boolean) => (on === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : on ? classes.add(c) : classes.delete(c)),
        contains: (c: string) => classes.has(c),
      },
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      addEventListener: (type: string, fn: Handler) => {
        (listeners[type] ??= []).push(fn);
      },
      appendChild: (child: El) => {
        target.children.push(child);
        return child;
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      focus: () => {},
      scrollTop: 0,
      scrollHeight: 0,
    };
    // The widget reads the last child it added (to keep typing into it); an unknown property must not look like one.
    for (const name of ["lastElementChild", "lastChild"]) {
      Object.defineProperty(target, name, { get: () => target.children[target.children.length - 1] ?? null });
    }
    let html = "";
    Object.defineProperty(target, "innerHTML", {
      get: () => html,
      set: (value: string) => {
        html = value;
        // Elements written as HTML become findable by id, with their initial `hidden` state.
        for (const m of value.matchAll(/<(\w+)([^>]*?\bid="([\w-]+)"[^>]*)>/g)) {
          const el = makeEl(m[1], m[2]);
          el.id = m[3];
          registry.set(m[3], el);
        }
      },
    });
    created.push(target);
    return new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop as string];
        if (prop === "then" || typeof prop === "symbol") return undefined;
        return () => makeEl();
      },
      set(t, prop, value) {
        t[prop as string] = value;
        return true;
      },
    });
  };

  const body = makeEl("body");
  // An element given an id and attached to the page can then be found by it, like in a real browser.
  body.appendChild = (child: El) => {
    if (child.id) registry.set(child.id, child);
    return child;
  };
  const script = { src: "http://localhost:9002/embed.js", getAttribute: (name: string) => ({ "data-user-id": "org-1", ...(opts.scriptAttrs ?? {}) })[name] ?? null };
  const document = new Proxy(
    {
      currentScript: script,
      body,
      createElement: (tag: string) => makeEl(tag),
      createTextNode: (text: string) => Object.assign(makeEl("#text"), { textContent: text }),
      getElementById: (id: string) => registry.get(id) ?? null,
      querySelector: () => null,
      addEventListener: () => {},
      activeElement: null,
    } as Record<string, any>,
    {
      get(t, prop) {
        if (prop in t) return t[prop as string];
        if (prop === "then" || typeof prop === "symbol") return undefined;
        return () => makeEl();
      },
    }
  );

  const json = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => data });
  const fetchImpl = (url: string) => {
    fetched.push(String(url));
    if (url.includes("/api/widget/greeting")) return opts.greetingNever ? new Promise(() => {}) : json({ greeting: "Welcome to Baghban Greens. How can I help?", siteName: "Baghban Greens" });
    if (url.includes("/api/theme")) return json({ theme: { bubbleColor: "#F0C545", headerColor: "#F0C545", userMsgColor: "#F0C545", sendBtnColor: "#F0C545", accentColor: "#F0C545" } });
    if (/\/api\/embed\/events\?/.test(url)) {
      return json({ events: opts.events ?? [], test: false, teaser: opts.teaser ?? DEFAULT, teaser_event_id: opts.teaserEventId ?? null });
    }
    return json({});
  };

  const storage = (map: Map<string, string>) => ({
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  });

  const context: Record<string, any> = {
    document,
    localStorage: storage(new Map()),
    sessionStorage: storage(session),
    fetch: fetchImpl,
    URL,
    AbortController,
    console: { warn() {}, info() {}, log() {}, error() {} },
    navigator: { userAgent: "test" },
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: any) => clearTimeout(id),
    setInterval: (fn: () => void, ms?: number) => setInterval(fn, ms),
    clearInterval: (id: any) => clearInterval(id),
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    crypto: { getRandomValues: (a: Uint8Array) => a },
    location: { origin: "http://localhost:9002", href: "http://localhost:9002/" },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "embed.js" });

  const click = (id: string) => registry.get(id)?.listeners.click?.forEach((fn: Handler) => fn({ stopPropagation() {}, preventDefault() {} }));
  const teaser = () => registry.get("nochbot-teaser")!;
  const teaserText = () => registry.get("nochbot-teaser-text")!.textContent as string;
  const visible = () => !teaser().hidden && teaser().classes.has("is-visible");
  /** The text of every quick-reply button currently offered in the chat, newest render last. */
  const buttons = () => created.filter((el) => String(el.className).split(" ").includes("nochbot-action")).map((el) => String(el.textContent));
  return { registry, fetched, click, teaser, teaserText, visible, session, buttons };
}

const settle = (ms: number) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the message beside the chat icon, as a visitor sees it", () => {
  it("offers help when no event is live", async () => {
    const env = makeEnv({});
    await settle(2000);
    expect(env.visible()).toBe(true);
    expect(env.teaserText()).toBe(DEFAULT);
  });

  it("announces a live event", async () => {
    const env = makeEnv({
      events: [{ id: "e1", name: "Launch Party", available_seats: 5 }],
      teaser: "Launch Party is live. Book your tickets now!",
      teaserEventId: "e1",
    });
    await settle(2000);
    expect(env.visible()).toBe(true);
    expect(env.teaserText()).toBe("Launch Party is live. Book your tickets now!");
  });

  it("appears quickly, without waiting for the greeting to be written", async () => {
    const env = makeEnv({ greetingNever: true });
    await settle(1200);
    expect(env.visible()).toBe(true);
    expect(env.teaserText()).toBe(DEFAULT);
  });

  it("is not shown before its short delay", async () => {
    const env = makeEnv({});
    await settle(300);
    expect(env.visible()).toBe(false);
  });

  it("goes away when the chat is opened, but comes back on the next visit", async () => {
    const session = new Map<string, string>();
    const first = makeEnv({ session });
    await settle(1500);
    expect(first.visible()).toBe(true);

    first.click("nochbot-toggle");
    await settle(500);
    expect(first.teaser().hidden).toBe(true);
    // Opening the chat is not a dismissal, so nothing is remembered.
    expect([...session.keys()].filter((k) => k.startsWith("nochbot_teaser_dismissed"))).toEqual([]);

    const second = makeEnv({ session });
    await settle(1500);
    expect(second.visible()).toBe(true);
  });

  it("stays away for the same message once the visitor closes it with its X", async () => {
    const session = new Map<string, string>();
    const first = makeEnv({ session });
    await settle(1500);
    first.click("nochbot-teaser-close");
    await settle(500);
    expect(first.teaser().hidden).toBe(true);

    const second = makeEnv({ session });
    await settle(2000);
    expect(second.visible()).toBe(false);
  });

  it("shows a different message again after an earlier one was closed", async () => {
    const session = new Map<string, string>();
    const first = makeEnv({ session });
    await settle(1500);
    first.click("nochbot-teaser-close");

    const live = makeEnv({
      session,
      events: [{ id: "e1", name: "Launch Party", available_seats: 5 }],
      teaser: "Launch Party is live. Book your tickets now!",
      teaserEventId: "e1",
    });
    await settle(2000);
    expect(live.visible()).toBe(true);
    expect(live.teaserText()).toBe("Launch Party is live. Book your tickets now!");
  });

  it("opens the chat and starts the booking when the live-event message is clicked", async () => {
    const env = makeEnv({
      events: [{ id: "e1", name: "Launch Party", available_seats: 5, date: "2026-12-01T10:00:00Z" }],
      teaser: "Launch Party is live. Book your tickets now!",
      teaserEventId: "e1",
    });
    await settle(2000);
    env.click("nochbot-teaser-text");
    await settle(500);
    expect(env.registry.get("nochbot-root")?.classes.has("is-open")).toBe(true);
    // With a single open event the booking goes straight to it.
    expect(env.fetched.some((u) => u.includes("/api/embed/events/e1"))).toBe(true);
  });

  it("only opens the chat when the plain help message is clicked", async () => {
    const env = makeEnv({});
    await settle(2000);
    env.click("nochbot-teaser-text");
    await settle(500);
    expect(env.registry.get("nochbot-root")?.classes.has("is-open")).toBe(true);
    expect(env.fetched.some((u) => /\/api\/embed\/events\/[a-z0-9]/i.test(u))).toBe(false);
  });

  it("offers the number of tickets as labelled buttons, not bare numbers", async () => {
    const env = makeEnv({
      events: [{ id: "e1", name: "Launch Party", available_seats: 5, date: "2026-12-01T10:00:00Z" }],
      teaser: "Launch Party is live. Book your tickets now!",
      teaserEventId: "e1",
    });
    await settle(2000);
    env.click("nochbot-teaser-text");
    // The widget types its replies out; the buttons appear once the question is fully shown.
    await settle(8000);
    const choices = env.buttons();
    expect(choices).toContain("1 ticket");
    expect(choices).toContain("2 tickets");
    expect(choices).toContain("4 tickets");
    expect(choices).not.toContain("1");
  });
});
