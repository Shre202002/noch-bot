import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildScanFeed } from "@/lib/scanFeed";
import { ensureScannerIndexes } from "@/lib/scannerLinkAuth";

export const dynamic = "force-dynamic";

// GET /api/events/[id]/scan-feed?since=<iso>&full=1
// Polled about once a second by the dashboard's Scanning tab. `full=1` also returns every attendee (first load, or when
// the counts show the list is out of date); otherwise only the scans since `since` come back.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });

    const db = await getDb();
    const eventId = new ObjectId(id);
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId }, { projection: { name: 1 } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    await ensureScannerIndexes(db);

    const { searchParams } = new URL(req.url);
    const feed = await buildScanFeed(db, userId, eventId, {
      since: searchParams.get("since"),
      full: searchParams.get("full") === "1",
    });
    return NextResponse.json({ eventName: event.name, ...feed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[scan_feed]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
