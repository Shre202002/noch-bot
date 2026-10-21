import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readyEventsForTest } from "@/lib/testBooking";

export const dynamic = "force-dynamic";

// GET /api/events/test-ready
// The organizer's upcoming events that are complete enough to try as an attendee (drafts included).
export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    const events = await readyEventsForTest(db, userId);
    return NextResponse.json({
      user_id: userId,
      events: events.map((e) => ({
        id: String(e._id),
        name: e.name,
        status: e.status,
        start_at: e.start_at,
        is_paid: !!e.is_paid,
      })),
    });
  } catch (error) {
    console.error("[events_test_ready]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
