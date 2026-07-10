import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const visitorId = searchParams.get('visitorId');

  if (!ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400, headers: corsHeaders });
  }

  try {
    const db = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
      org_id: userId,
      visitor_id: visitorId
    });

    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });

    // Handle Expiry
    if (booking.status === "pending_payment" && booking.expires_at && booking.expires_at < new Date()) {
      await db.collection("bookings").updateOne(
        { _id: booking._id },
        { $set: { status: "expired", payment_status: "failed", updated_at: new Date() } }
      );
      return NextResponse.json({
        status: "expired",
        payment_status: "failed",
        can_download_ticket: false
      }, { headers: corsHeaders });
    }

    const canDownload = booking.status === "confirmed" && 
      (booking.payment_status === "not_required" || booking.payment_status === "paid");

    return NextResponse.json({
      status: booking.status,
      payment_status: booking.payment_status,
      booking_code: booking.booking_code,
      can_download_ticket: canDownload,
      download_url: canDownload ? `/api/embed/bookings/${bookingId}/ticket?userId=${userId}&visitorId=${visitorId}` : undefined
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}