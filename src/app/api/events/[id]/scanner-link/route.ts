import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  createScannerLink,
  ensureScannerIndexes,
  getScannerLinkForEvent,
  rotateScannerLink,
  setScannerLinkActive,
} from "@/lib/scannerLinkAuth";

const ACTIONS = ["create", "rotate", "enable", "disable"] as const;
type Action = (typeof ACTIONS)[number];

/** The organizer's own event, or the response to return. */
async function ownedEvent(id: string) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  const db = await getDb();
  const eventId = new ObjectId(id);
  const event = await db.collection("events").findOne({ _id: eventId, org_id: userId }, { projection: { _id: 1 } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  await ensureScannerIndexes(db);
  return { db, userId, eventId };
}

const shape = (link: { slug: string; active: boolean } | null) => (link ? { slug: link.slug, active: link.active } : null);

// GET /api/events/[id]/scanner-link → { link: { slug, active } | null }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owned = await ownedEvent((await params).id);
    if (owned instanceof NextResponse) return owned;
    return NextResponse.json({ link: shape(await getScannerLinkForEvent(owned.db, owned.userId, owned.eventId)) });
  } catch (error) {
    console.error("[scanner_link_get]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/events/[id]/scanner-link  Body: { action: "create" | "rotate" | "enable" | "disable" }
// rotate gives the event a new address (for a leaked link) and signs every scanner out.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owned = await ownedEvent((await params).id);
    if (owned instanceof NextResponse) return owned;

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    if (!ACTIONS.includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const { db, userId, eventId } = owned;
    if (action === "create") return NextResponse.json({ link: shape(await createScannerLink(db, userId, eventId)) });

    if (action === "rotate") {
      const link = await rotateScannerLink(db, userId, eventId);
      return link ? NextResponse.json({ link: shape(link) }) : NextResponse.json({ error: "Create the link first." }, { status: 409 });
    }

    const done = await setScannerLinkActive(db, userId, eventId, action === "enable");
    if (!done) return NextResponse.json({ error: "Create the link first." }, { status: 409 });
    return NextResponse.json({ link: shape(await getScannerLinkForEvent(db, userId, eventId)) });
  } catch (error) {
    console.error("[scanner_link_post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
