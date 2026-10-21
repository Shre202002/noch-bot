import { NextResponse } from "next/server";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bookingOverview } from "@/lib/bookingOverview";

export const dynamic = "force-dynamic";

// GET /api/bookings/overview
// The signed-in organizer's events with a count of bookings in each state.
export async function GET() {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    return NextResponse.json({ events: await bookingOverview(db, userId) });
  } catch (error) {
    console.error("[bookings_overview]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
