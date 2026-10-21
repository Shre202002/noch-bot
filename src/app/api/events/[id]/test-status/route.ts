import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { testSummary } from "@/lib/testBooking";

export const dynamic = "force-dynamic";

// GET /api/events/[id]/test-status
// Whether this event can be tried as an attendee yet, what is missing if not, and how many test bookings exist.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const db = await getDb();
    const summary = await testSummary(db, userId, new ObjectId(id));
    if (!summary.found) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({
      user_id: userId,
      ready: summary.ready,
      missing: summary.missing,
      test_count: summary.testCount,
    });
  } catch (error) {
    console.error("[event_test_status]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
