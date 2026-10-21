import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { allowedActions, BOOKING_GROUPS, listEventBookings, type BookingFilter } from "@/lib/organizerBookings";
import { clearTestBookings } from "@/lib/testBooking";

// GET /api/events/[id]/bookings?q=&group=&page=
// The organizer's bookings for one event: searchable by attendee, reference or ticket code, filterable by what
// needs doing, with counts per group.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(id);
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const url = new URL(req.url);
    const groupParam = url.searchParams.get("group") ?? "all";
    const group = groupParam === "all" || groupParam === "test" || groupParam in BOOKING_GROUPS ? (groupParam as BookingFilter) : "all";
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);

    const list = await listEventBookings(db, eventId, {
      q: (url.searchParams.get("q") ?? "").slice(0, 100),
      group,
      page: Number.isFinite(page) ? page : 1,
    });

    return NextResponse.json({
      bookings: list.rows.map((row) => ({ ...row, actions: allowedActions(row.status, row.is_test) })),
      total: list.total,
      page: list.page,
      pageSize: list.pageSize,
      counts: list.counts,
      test_count: list.testCount,
      truncated: list.truncated,
    });
  } catch (error) {
    console.error("[bookings_list]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/events/[id]/bookings
// Removes this event's test bookings (with their tickets and sessions). Real bookings are never touched.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const db = await getDb();
    const eventId = new ObjectId(id);
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ success: true, removed: await clearTestBookings(db, userId, eventId) });
  } catch (error) {
    console.error("[bookings_clear_tests]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
