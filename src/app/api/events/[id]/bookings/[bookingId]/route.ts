import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string, bookingId: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.bookingId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const bookingId = new ObjectId(params.bookingId);

    // 1. Verify event ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // 2. Fetch booking (full)
    const booking = await db.collection("bookings").findOne({ 
      _id: bookingId, 
      event_id: eventId 
    });
    
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    // 3. Fetch linked tickets
    const tickets = await db.collection("tickets")
      .find({ booking_id: bookingId })
      .toArray();

    return NextResponse.json({ 
      success: true, 
      data: { 
        ...booking, 
        tickets 
      } 
    });
  } catch (error) {
    console.error("[booking_get_detail]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
