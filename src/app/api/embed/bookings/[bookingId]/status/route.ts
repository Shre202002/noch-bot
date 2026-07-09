import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const visitorId = searchParams.get('visitorId');

  if (!ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
      org_id: userId,
      visitor_id: visitorId
    });

    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      status: booking.status,
      payment_status: booking.payment_status,
      booking_code: booking.booking_code,
      can_download_ticket: booking.status === "confirmed",
      download_url: booking.status === "confirmed" ? `/api/embed/bookings/${bookingId}/ticket` : undefined
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
