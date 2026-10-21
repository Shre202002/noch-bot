/**
 * The message beside the chat icon, and the chat icon choice, through the real route handlers.
 */
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { type Db } from "mongodb";
import { NextRequest } from "next/server";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

let signedInAs: string | null = null;
vi.mock("@/lib/auth", () => ({ getUserIdFromCookie: vi.fn(async () => signedInAs) }));

vi.setConfig({ testTimeout: 60_000 });

const ORG = "org-teaser-1";
const BASE = "http://localhost:9002";
let db: Db;

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const DAY = 86400_000;
const event = (fields: Record<string, unknown> = {}) => ({
  org_id: ORG,
  name: "Launch Party",
  description: "",
  status: "published",
  start_at: new Date(Date.now() + 3 * DAY),
  end_at: new Date(Date.now() + 3 * DAY + 3600_000),
  venue: "Hall",
  capacity: 10,
  tickets_sold: 0,
  tickets_held: 0,
  is_paid: false,
  price: null,
  currency: "INR",
  ticket_template_id: "dark",
  ...fields,
});

beforeAll(async () => {
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  db = await getDb();
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  for (const name of ["events", "event_form_fields", "knowledge"]) await db.collection(name).deleteMany({});
  signedInAs = null;
});

describe("the message beside the chat icon", () => {
  const teaser = async (query = "") => {
    const { GET } = await import("@/app/api/embed/events/route");
    return (await GET(req(`/api/embed/events?userId=${ORG}${query}`))).json();
  };

  it("offers help when there is no event", async () => {
    const data = await teaser();
    expect(data.teaser).toBe("I'm here to help you.");
    expect(data.teaser_event_id).toBeNull();
  });

  it("announces a live event", async () => {
    const id = (await db.collection("events").insertOne(event())).insertedId.toString();
    const data = await teaser();
    expect(data.teaser).toBe("Launch Party is live. Book your tickets now!");
    expect(data.teaser_event_id).toBe(id);
  });

  it("announces the soonest live event", async () => {
    await db.collection("events").insertMany([
      event({ name: "Later Show", start_at: new Date(Date.now() + 20 * DAY), end_at: new Date(Date.now() + 20 * DAY + 3600_000) }),
      event({ name: "Sooner Show", start_at: new Date(Date.now() + 2 * DAY), end_at: new Date(Date.now() + 2 * DAY + 3600_000) }),
    ]);
    expect((await teaser()).teaser).toBe("Sooner Show is live. Book your tickets now!");
  });

  it("does not announce a draft, a sold-out event or one that has ended", async () => {
    await db.collection("events").insertMany([
      event({ name: "Draft Show", status: "draft" }),
      event({ name: "Full Show", capacity: 5, tickets_sold: 5 }),
      event({ name: "Old Show", end_at: new Date(Date.now() - DAY), start_at: new Date(Date.now() - 2 * DAY) }),
    ]);
    expect((await teaser()).teaser).toBe("I'm here to help you.");
  });

  it("does not count seats held by checkouts in progress", async () => {
    await db.collection("events").insertOne(event({ name: "Held Show", capacity: 4, tickets_sold: 1, tickets_held: 3 }));
    expect((await teaser()).teaser).toBe("I'm here to help you.");
  });

  it("never announces someone else's event", async () => {
    await db.collection("events").insertOne(event({ org_id: "someone-else" }));
    expect((await teaser()).teaser).toBe("I'm here to help you.");
  });

  it("stays on the help message in test mode, even with a ready draft", async () => {
    signedInAs = ORG;
    const id = (await db.collection("events").insertOne(event({ status: "draft", ticket_design_confirmed_at: new Date(), description: "A day out" }))).insertedId;
    await db.collection("event_form_fields").insertOne({ event_id: id, label: "Name", field_key: "name", field_type: "text", order_index: 0 });
    const data = await teaser("&test=1");
    expect(data.events).toHaveLength(1);
    expect(data.teaser).toBe("I'm here to help you.");
  });
});

describe("the chat icon in the theme", () => {
  const theme = { bubbleColor: "#36f4a4", headerColor: "#36f4a4", userMsgColor: "#36f4a4", sendBtnColor: "#36f4a4", accentColor: "#36f4a4" };
  const save = async (t: Record<string, unknown>) => {
    const { POST } = await import("@/app/api/theme/route");
    return POST(req("/api/theme", "POST", { theme: t }));
  };
  const load = async () => {
    const { GET } = await import("@/app/api/theme/route");
    return (await GET(req(`/api/theme?userId=${ORG}`))).json();
  };

  it("saves a known icon and hands the widget its image path", async () => {
    signedInAs = ORG;
    expect((await save({ ...theme, launcherIcon: "smile" })).status).toBe(200);
    const { theme: saved } = await load();
    expect(saved.launcherIcon).toBe("smile");
    expect(saved.launcherIconUrl).toBe("/chat-icon-5.svg");
  });

  it("gives no image path for the robot, which needs none", async () => {
    signedInAs = ORG;
    await save({ ...theme, launcherIcon: "default" });
    const { theme: saved } = await load();
    expect(saved.launcherIcon).toBe("default");
    expect(saved.launcherIconUrl).toBeUndefined();
  });

  it("rejects an unknown icon and keeps what was saved before", async () => {
    signedInAs = ORG;
    await save({ ...theme, launcherIcon: "orb" });
    for (const bad of ["nope", "../../secret.svg", "__proto__", "", 7]) {
      expect((await save({ ...theme, launcherIcon: bad })).status, String(bad)).toBe(400);
    }
    expect((await load()).theme.launcherIcon).toBe("orb");
  });

  it("never passes on an image address that was stored in the theme", async () => {
    // Even if a bad value were already in the database, the widget only ever receives a path from our own list.
    await db.collection("knowledge").insertOne({ userId: ORG, theme: { ...theme, launcherIcon: "orb", launcherIconUrl: "https://evil.example/x.svg" } });
    const { theme: saved } = await load();
    expect(saved.launcherIconUrl).toBe("/chat-icon-7.svg");

    await db.collection("knowledge").deleteMany({});
    await db.collection("knowledge").insertOne({ userId: ORG, theme: { ...theme, launcherIcon: "../../etc/passwd", launcherIconUrl: "https://evil.example/x.svg" } });
    expect((await load()).theme.launcherIconUrl).toBeUndefined();
  });

  it("does not store an image address sent with the theme", async () => {
    signedInAs = ORG;
    expect((await save({ ...theme, launcherIcon: "smile", launcherIconUrl: "https://evil.example/x.svg" })).status).toBe(200);
    const stored = await db.collection("knowledge").findOne({ userId: ORG });
    expect(stored?.theme.launcherIconUrl).toBeUndefined();
    expect((await load()).theme.launcherIconUrl).toBe("/chat-icon-5.svg");
  });

  it("still works for a theme saved before icons existed", async () => {
    await db.collection("knowledge").insertOne({ userId: ORG, theme });
    const { theme: saved } = await load();
    expect(saved.bubbleColor).toBe("#36f4a4");
    expect(saved.launcherIconUrl).toBeUndefined();
  });

  it("requires a signed-in organizer to save", async () => {
    signedInAs = null;
    expect((await save({ ...theme, launcherIcon: "smile" })).status).toBe(401);
  });
});
