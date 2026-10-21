import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { releaseExpiredHolds } from "@/lib/eventCapacity";
import { ticketPageUrl, ticketPdfUrl } from "@/lib/ticketLinks";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/embed/bookings/[bookingId]/status?userId&visitorId
// Polled by the chat widget after it opens a checkout, until the booking is confirmed, failed or expired.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const visitorId = searchParams.get('visitorId');

  if (!userId || !visitorId) {
    return NextResponse.json({ error: "Missing identity parameters" }, { status: 400, headers: corsHeaders });
  }

  if (!ObjectId.isValid(bookingId)) {
    return NextResponse.json({ error: "Invalid booking ID" }, { status: 400, headers: corsHeaders });
  }

  const describe = (booking: Record<string, any>) => {
    const canDownload = booking.status === "confirmed" &&
      (booking.payment_status === "not_required" || booking.payment_status === "paid");
    return {
      booking_id: booking._id.toString(),
      status: booking.status,
      payment_status: booking.payment_status,
      booking_code: booking.booking_code,
      can_download_ticket: canDownload,
      download_url: canDownload ? `/api/embed/bookings/${bookingId}/ticket?userId=${userId}&visitorId=${visitorId}` : undefined,
      ticket_page_url: canDownload ? ticketPageUrl(bookingId, userId, visitorId) : undefined,
      ticket_pdf_url: canDownload ? ticketPdfUrl(bookingId, userId, visitorId) : undefined,
    };
  };

  try {
    const db = await getDb();
    const filter = { _id: new ObjectId(bookingId), org_id: userId, visitor_id: visitorId };
    let booking = await db.collection("bookings").findOne(filter);

    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });

    // Overdue checkout: give its held seats back through the shared sweep (each booking is claimed atomically, so a
    // payment confirmed at the same moment keeps them), then mark older hold-less bookings expired too.
    if (booking.status === "pending_payment" && booking.expires_at && new Date(booking.expires_at) < new Date()) {
      await releaseExpiredHolds(booking.event_id);
      await db.collection("bookings").updateOne(
        { _id: booking._id, status: { $in: ["pending_payment", "expired"] } },
        { $set: { status: "expired", payment_status: "failed", updated_at: new Date() } }
      );
      booking = await db.collection("bookings").findOne(filter);
      if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(describe(booking), { headers: corsHeaders });
  } catch (error) {
    console.error("[status_api_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
