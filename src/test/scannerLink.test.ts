/**
 * The shareable ticket-scanner link through the real route handlers: the organizer shares a link for one event, door staff
 * register and wait for approval, an approved account scans that event's tickets only, and the organizer's live feed
 * reflects every scan. Tenant isolation: other organizers and other events are always out of reach.
 */
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import crypto from "crypto";
import { ObjectId, type Db } from "mongodb";
import { NextRequest } from "next/server";
import { startTestMongo, stopTestMongo } from "@/test/mongo-setup";

// Who is signed in to the dashboard for the request being made.
let signedInAs: string | null = null;
vi.mock("@/lib/auth", () => ({ getUserIdFromCookie: vi.fn(async () => signedInAs) }));

vi.setConfig({ testTimeout: 120_000 });

const ORG = "org-scan-1";
const OTHER = "org-scan-2";
const SECRET = "vitest-qr-secret";
const BASE = "http://localhost:9002";
let db: Db;

const req = (url: string, method = "GET", body?: unknown, cookie?: string) =>
  new NextRequest(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

const makeEvent = async (org = ORG, name = "Launch Party") =>
  (await db.collection("events").insertOne({ org_id: org, name, status: "published", start_at: new Date(), end_at: new Date(Date.now() + 3600_000), venue: "Hall B" }))
    .insertedId as ObjectId;

let codeCounter = 0;
/** A confirmed booking with `quantity` real tickets, signed the way ticket issuance signs them. */
async function makeBooking(eventId: ObjectId, opts: { quantity?: number; status?: string; test?: boolean; name?: string; org?: string } = {}) {
  const quantity = opts.quantity ?? 1;
  const bookingId = (
    await db.collection("bookings").insertOne({
      org_id: opts.org ?? ORG,
      event_id: eventId,
      status: opts.status ?? "confirmed",
      quantity,
      booking_code: `NBK-TEST-${++codeCounter}`,
      ...(opts.test ? { is_test: true } : {}),
      attendee: {
        answers: [
          { label: "Full name", value: opts.name ?? "Asha Rao", validation_rule: "name_format" },
          { label: "Email", value: "asha@example.com", validation_rule: "email_format", field_type: "email" },
        ],
      },
    })
  ).insertedId;
  const codes: string[] = [];
  for (let i = 0; i < quantity; i++) {
    const code = `EVT-${String(++codeCounter).padStart(8, "A")}`;
    codes.push(code);
    await db.collection("tickets").insertOne({
      booking_id: bookingId,
      event_id: eventId,
      ticket_code: code,
      ticket_index: i,
      qr_payload_hash: crypto.createHmac("sha256", SECRET).update(`${code}:${bookingId}:${eventId}`).digest("hex"),
      status: "active",
      scanned_at: null,
      scanned_by_staff_id: null,
      ...(opts.test ? { is_test: true } : {}),
    });
  }
  return { bookingId, codes };
}

// ── the routes, as a client calls them ───────────────────────────────────────

const link = async (eventId: ObjectId, action: string) => {
  const { POST } = await import("@/app/api/events/[id]/scanner-link/route");
  return POST(req(`/api/events/${eventId}/scanner-link`, "POST", { action }), params({ id: eventId.toString() }));
};
const getLink = async (eventId: ObjectId) => {
  const { GET } = await import("@/app/api/events/[id]/scanner-link/route");
  return GET(req(`/api/events/${eventId}/scanner-link`), params({ id: eventId.toString() }));
};
const register = async (slug: string, loginId: string, password = "password123", name: unknown = "Gate One") => {
  const { POST } = await import("@/app/api/scan/[slug]/auth/register/route");
  return POST(req(`/api/scan/${slug}/auth/register`, "POST", { loginId, password, name }), params({ slug }));
};
const login = async (slug: string, loginId: string, password = "password123") => {
  const { POST } = await import("@/app/api/scan/[slug]/auth/login/route");
  const res = await POST(req(`/api/scan/${slug}/auth/login`, "POST", { loginId, password }), params({ slug }));
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { res, cookie };
};
const me = async (slug: string, cookie?: string) => {
  const { GET } = await import("@/app/api/scan/[slug]/auth/me/route");
  return (await GET(req(`/api/scan/${slug}/auth/me`, "GET", undefined, cookie), params({ slug }))).json();
};
const scan = async (slug: string, ticketCode: string, cookie?: string, extra: Record<string, unknown> = {}) => {
  const { POST } = await import("@/app/api/scan/[slug]/scan/route");
  const res = await POST(req(`/api/scan/${slug}/scan`, "POST", { ticketCode, ...extra }, cookie), params({ slug }));
  return { status: res.status, body: await res.json(), headers: res.headers };
};
const decide = async (eventId: ObjectId, userId: string, action: string) => {
  const { PATCH } = await import("@/app/api/events/[id]/scanner-users/[userId]/route");
  return PATCH(req(`/api/events/${eventId}/scanner-users/${userId}`, "PATCH", { action }), params({ id: eventId.toString(), userId }));
};
const feed = async (eventId: ObjectId, query = "") => {
  const { GET } = await import("@/app/api/events/[id]/scan-feed/route");
  const res = await GET(req(`/api/events/${eventId}/scan-feed${query}`), params({ id: eventId.toString() }));
  return { status: res.status, body: await res.json() };
};

/** A shared link with one approved, signed-in scanner account. */
async function readyScanner(eventId: ObjectId, loginId = "gate-1") {
  const { link: l } = await (await link(eventId, "create")).json();
  await register(l.slug, loginId);
  const accounts = (await feed(eventId)).body.scanners as Array<{ id: string; loginId: string }>;
  await decide(eventId, accounts.find((a) => a.loginId === loginId)!.id, "approve");
  const { cookie } = await login(l.slug, loginId);
  return { slug: l.slug as string, cookie, userId: accounts.find((a) => a.loginId === loginId)!.id };
}

beforeAll(async () => {
  process.env.NEXTAUTH_URL = BASE;
  await startTestMongo();
  const { getDb } = await import("@/lib/db");
  db = await getDb();
});

afterAll(async () => {
  await stopTestMongo();
});

beforeEach(async () => {
  for (const name of ["events", "bookings", "tickets", "scanner_links", "scanner_users"]) {
    await db.collection(name).deleteMany({});
  }
  signedInAs = ORG;
});

describe("the organizer's scanner link", () => {
  it("is created once per event, and only for the organizer's own event", async () => {
    const eventId = await makeEvent();
    const first = (await (await link(eventId, "create")).json()).link;
    const again = (await (await link(eventId, "create")).json()).link;
    expect(first.slug).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(again.slug).toBe(first.slug);
    expect(first.active).toBe(true);

    signedInAs = OTHER;
    expect((await link(eventId, "create")).status).toBe(404);
    expect((await getLink(eventId)).status).toBe(404);
    signedInAs = null;
    expect((await link(eventId, "create")).status).toBe(401);
  });

  it("rotating gives a new address, keeps the accounts, and signs everyone out", async () => {
    const eventId = await makeEvent();
    const { slug, cookie } = await readyScanner(eventId);
    expect((await me(slug, cookie)).signedIn).toBe(true);

    const rotated = (await (await link(eventId, "rotate")).json()).link;
    expect(rotated.slug).not.toBe(slug);

    // The old address and the old session no longer work.
    const { GET } = await import("@/app/api/scan/[slug]/auth/me/route");
    expect((await GET(req(`/api/scan/${slug}/auth/me`, "GET", undefined, cookie), params({ slug }))).status).toBe(404);
    expect((await me(rotated.slug, cookie)).signedIn).toBe(false);

    // The approved account survived: it can sign in again at the new address.
    const again = await login(rotated.slug, "gate-1");
    expect(again.res.status).toBe(200);
  });

  it("switching it off closes the public routes, and back on reopens them", async () => {
    const eventId = await makeEvent();
    const { slug, cookie } = await readyScanner(eventId);
    await link(eventId, "disable");
    expect((await scan(slug, "EVT-AAAAAAAA", cookie)).status).toBe(404);
    expect((await register(slug, "late-comer")).status).toBe(404);

    await link(eventId, "enable");
    expect((await me(slug, cookie)).signedIn).toBe(true);
  });
});

describe("scanner accounts", () => {
  it("wait for approval: registering gives a pending account that cannot sign in or scan", async () => {
    const eventId = await makeEvent();
    const { link: l } = await (await link(eventId, "create")).json();

    expect((await register(l.slug, "gate-1")).status).toBe(200);
    expect((await register(l.slug, "gate-1")).status).toBe(409);
    expect((await register(l.slug, "x")).status).toBe(400);
    expect((await register(l.slug, "gate-2", "short")).status).toBe(400);

    const attempt = await login(l.slug, "gate-1");
    expect(attempt.res.status).toBe(403);
    expect((await attempt.res.json()).code).toBe("pending");
    expect(attempt.cookie).toBe("");
    expect((await scan(l.slug, "EVT-AAAAAAAA")).status).toBe(401);
  });

  it("asks for a name, tidies it, and shows it to the organizer", async () => {
    const eventId = await makeEvent();
    const { link: l } = await (await link(eventId, "create")).json();

    for (const bad of [null, "", " ", "A", "x".repeat(61), 42]) {
      const res = await register(l.slug, "gate-9", "password123", bad);
      expect(res.status, String(bad)).toBe(400);
      expect((await res.json()).code).toBe("invalid_name");
    }
    expect((await register(l.slug, "gate-9", "password123", "  Asha    Rao ")).status).toBe(200);
    const [account] = (await feed(eventId)).body.scanners;
    expect(account).toMatchObject({ loginId: "gate-9", name: "Asha Rao", status: "pending" });
  });

  it("can sign in once the organizer approves; only that organizer can decide", async () => {
    const eventId = await makeEvent();
    const { link: l } = await (await link(eventId, "create")).json();
    await register(l.slug, "gate-1");
    const [account] = (await feed(eventId)).body.scanners;
    expect(account.status).toBe("pending");

    signedInAs = OTHER;
    expect((await decide(eventId, account.id, "approve")).status).toBe(404);
    signedInAs = ORG;
    expect((await login(l.slug, "gate-1")).res.status).toBe(403);

    expect((await decide(eventId, account.id, "approve")).status).toBe(200);
    const signedIn = await login(l.slug, "gate-1");
    expect(signedIn.res.status).toBe(200);
    expect(signedIn.cookie).toMatch(/^nbs_/);
    const status = await me(l.slug, signedIn.cookie);
    expect(status).toMatchObject({ signedIn: true, loginId: "gate-1", name: "Gate One", event: { name: "Launch Party", venue: "Hall B" } });
    // The sign-in screen can show which event the link is for before anyone signs in.
    expect(await me(l.slug)).toMatchObject({ signedIn: false, event: { name: "Launch Party" } });
  });

  it("stay on one device, but are never locked out for signing in often", async () => {
    const eventId = await makeEvent();
    const { slug, cookie: phoneA } = await readyScanner(eventId);
    const { cookie: phoneB } = await login(slug, "gate-1");

    expect((await me(slug, phoneB)).signedIn).toBe(true);
    const replaced = await me(slug, phoneA);
    expect(replaced).toMatchObject({ signedIn: false, code: "replaced" });

    // The PDF links block on a third sign-in within 48 hours; scanners do not.
    for (let i = 0; i < 6; i++) expect((await login(slug, "gate-1")).res.status).toBe(200);
  });

  it("can be blocked, signed out and removed by the organizer", async () => {
    const eventId = await makeEvent();
    const { slug, cookie, userId } = await readyScanner(eventId);
    const { codes } = await makeBooking(eventId);

    await decide(eventId, userId, "block");
    expect((await scan(slug, codes[0], cookie)).status).toBe(403);
    expect((await login(slug, "gate-1")).res.status).toBe(403);

    await decide(eventId, userId, "unblock");
    const back = await login(slug, "gate-1");
    expect(back.res.status).toBe(200);
    await decide(eventId, userId, "signout");
    expect((await scan(slug, codes[0], back.cookie)).status).toBe(401);

    await decide(eventId, userId, "remove");
    expect((await login(slug, "gate-1")).res.status).toBe(401);
  });

  it("do not accept a PDF share-link session", async () => {
    const eventId = await makeEvent();
    const { slug, userId } = await readyScanner(eventId);
    const { signLinkToken } = await import("@/lib/linkUserAuth");
    const forged = signLinkToken({ _id: new ObjectId(userId), slug }, "any-session");
    expect((await me(slug, `nbs_${slug}=${forged}`)).signedIn).toBe(false);
  });
});

describe("scanning", () => {
  it("admits a valid ticket once, then reports who scanned it and when", async () => {
    const eventId = await makeEvent();
    const { slug, cookie } = await readyScanner(eventId);
    const { codes } = await makeBooking(eventId, { quantity: 2, name: "Asha Rao" });

    const first = await scan(slug, codes[0], cookie);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ result: "admitted", code: codes[0], attendee: "Asha Rao" });
    // The route answers without computing door counts (the scanner updates them itself) and reports its own timing.
    expect(first.body.counts).toBeUndefined();
    expect(first.headers.get("server-timing")).toMatch(/^scan;dur=\d+$/);
    expect((await feed(eventId)).body.counts).toEqual({ total: 2, scanned: 1, remaining: 1 });

    const second = await scan(slug, codes[0], cookie);
    expect(second.body).toMatchObject({ result: "already_scanned", attendee: "Asha Rao", scannedBy: "Gate One" });
    expect(new Date(second.body.scannedAt).getTime()).toBeGreaterThan(0);

    const stored = await db.collection("tickets").findOne({ ticket_code: codes[0] });
    expect(stored).toMatchObject({ status: "scanned", scanned_by_name: "Gate One" });
  });

  it("accepts the same scan retried by the same device, and a link that holds the code", async () => {
    const eventId = await makeEvent();
    const { slug, cookie } = await readyScanner(eventId);
    const { codes } = await makeBooking(eventId, { quantity: 2 });

    expect((await scan(slug, codes[0], cookie, { clientScanId: "s1" })).body.result).toBe("admitted");
    const retry = await scan(slug, codes[0], cookie, { clientScanId: "s1" });
    expect(retry.body).toMatchObject({ result: "admitted", retry: true });
    expect((await scan(slug, `https://x.test/t?c=${codes[1].toLowerCase()}`, cookie)).body.result).toBe("admitted");
  });

  it("refuses what must not get in, without ever marking it scanned", async () => {
    const eventId = await makeEvent();
    const otherEvent = await makeEvent(ORG, "Another Event");
    const { slug, cookie } = await readyScanner(eventId);

    const forged = (await makeBooking(eventId)).codes[0];
    await db.collection("tickets").updateOne({ ticket_code: forged }, { $set: { qr_payload_hash: "0".repeat(64) } });
    const elsewhere = (await makeBooking(otherEvent)).codes[0];
    const test = (await makeBooking(eventId, { test: true })).codes[0];
    const refunded = (await makeBooking(eventId, { status: "needs_refund" })).codes[0];

    expect((await scan(slug, forged, cookie)).body.result).toBe("tampered");
    expect((await scan(slug, elsewhere, cookie)).body.result).toBe("wrong_event");
    expect((await scan(slug, test, cookie)).body.result).toBe("test_ticket");
    expect((await scan(slug, refunded, cookie)).body.result).toBe("not_confirmed");
    expect((await scan(slug, "EVT-ZZZZZZZZ", cookie)).body.result).toBe("not_found");
    expect((await scan(slug, "hello", cookie)).body.result).toBe("invalid");

    for (const code of [forged, elsewhere, test, refunded]) {
      expect((await db.collection("tickets").findOne({ ticket_code: code }))?.status).toBe("active");
    }
  });

  it("only works for a signed-in, approved account of that event's link", async () => {
    const eventId = await makeEvent();
    const { slug, cookie } = await readyScanner(eventId);
    const { codes } = await makeBooking(eventId);

    expect((await scan(slug, codes[0])).status).toBe(401);
    expect((await scan(slug, codes[0], "nbs_garbage=abc")).status).toBe(401);

    // An account of another event's link cannot use its cookie here.
    const otherEvent = await makeEvent();
    const other = await readyScanner(otherEvent, "gate-9");
    expect((await scan(slug, codes[0], other.cookie)).status).toBe(401);
    expect((await scan(other.slug, codes[0], other.cookie)).body.result).toBe("wrong_event");
    expect((await scan(slug, codes[0], cookie)).body.result).toBe("admitted");
  });
});

describe("the organizer's live feed", () => {
  it("lists every attendee with their status, and counts real tickets only", async () => {
    const eventId = await makeEvent();
    await makeBooking(eventId, { quantity: 2, name: "Asha Rao" });
    await makeBooking(eventId, { name: "Ben Ito" });
    await makeBooking(eventId, { test: true });
    await makeBooking(eventId, { status: "needs_refund" });

    const { status, body } = await feed(eventId, "?full=1");
    expect(status).toBe(200);
    expect(body.eventName).toBe("Launch Party");
    expect(body.counts).toEqual({ total: 3, scanned: 0, remaining: 3 });
    expect(body.attendees).toHaveLength(3);
    expect(body.attendees.map((a: { name: string }) => a.name).sort()).toEqual(["Asha Rao", "Asha Rao", "Ben Ito"]);
    expect(body.attendees[0]).toMatchObject({ status: "active", email: "asha@example.com", scannedAt: null });
    expect(body.cursor).toBeNull();
  });

  it("returns only the scans since the cursor, with who scanned and the new counts", async () => {
    const eventId = await makeEvent();
    const { slug, cookie } = await readyScanner(eventId);
    const { codes } = await makeBooking(eventId, { quantity: 3 });

    await scan(slug, codes[0], cookie);
    const afterFirst = (await feed(eventId, "?full=1")).body;
    expect(afterFirst.counts).toEqual({ total: 3, scanned: 1, remaining: 2 });
    expect(afterFirst.cursor).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 15));
    await scan(slug, codes[1], cookie);
    const poll = (await feed(eventId, `?since=${encodeURIComponent(afterFirst.cursor)}`)).body;
    expect(poll.counts).toEqual({ total: 3, scanned: 2, remaining: 1 });
    expect(poll.attendees).toBeNull();
    // The cursor itself is inclusive (so scans in the same millisecond are never lost); the client merges by code.
    expect(poll.scans.map((s: { code: string }) => s.code)).toEqual([codes[0], codes[1]]);
    expect(poll.scans[1]).toMatchObject({ status: "scanned", scannedBy: "Gate One", label: "Ticket 2 of 3" });

    const quiet = (await feed(eventId, `?since=${encodeURIComponent(poll.cursor)}`)).body;
    expect(quiet.scans.map((s: { code: string }) => s.code)).toEqual([codes[1]]);
  });

  it("shows the scanner accounts, with the pending ones counted", async () => {
    const eventId = await makeEvent();
    const { slug } = await readyScanner(eventId);
    await register(slug, "gate-2");
    const { body } = await feed(eventId);
    expect(body.link).toEqual({ slug, active: true });
    expect(body.scanners.map((s: { loginId: string; status: string }) => `${s.loginId}:${s.status}`).sort()).toEqual(["gate-1:approved", "gate-2:pending"]);
    expect(body.pendingScanners).toBe(1);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|currentSessionId/);
  });

  it("also shows a dashboard check-in, and a check-in that was undone drops out of the counts", async () => {
    const eventId = await makeEvent();
    const { codes } = await makeBooking(eventId, { quantity: 2 });
    const { checkInTicket, undoCheckIn } = await import("@/lib/organizerBookings");

    await checkInTicket(db, eventId, codes[0], ORG);
    const checked = (await feed(eventId, "?full=1")).body;
    expect(checked.counts.scanned).toBe(1);
    expect(checked.attendees.find((a: { code: string }) => a.code === codes[0])).toMatchObject({ status: "scanned", scannedBy: "Organizer" });

    await undoCheckIn(db, eventId, codes[0]);
    expect((await feed(eventId)).body.counts).toEqual({ total: 2, scanned: 0, remaining: 2 });
  });

  it("is private to the event's organizer", async () => {
    const eventId = await makeEvent();
    await makeBooking(eventId);
    signedInAs = OTHER;
    expect((await feed(eventId, "?full=1")).status).toBe(404);
    signedInAs = null;
    expect((await feed(eventId)).status).toBe(401);
    signedInAs = ORG;
    expect((await feed(new ObjectId())).status).toBe(404);
  });
});
