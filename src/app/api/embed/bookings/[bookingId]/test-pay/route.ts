import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { confirmTestBooking } from "@/lib/testBooking";
import { ticketPageUrl, ticketPdfUrl } from "@/lib/ticketLinks";

export const dynamic = "force-dynamic";

// POST /api/embed/bookings/[bookingId]/test-pay   { userId, visitorId, outcome: "paid" | "failed" }
// The simulated payment of a TEST booking. Only the signed-in organizer who made the test can finish it, and only a
// booking marked as a test: no gateway is called and no money moves.
export async function POST(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const cookieUser = await getUserIdFromCookie().catch(() => null);
  if (!cookieUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(bookingId)) return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });

  try {
    const { userId, visitorId, outcome } = await req.json().catch(() => ({}));
    if (userId !== cookieUser || !visitorId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (outcome !== "paid" && outcome !== "failed") return NextResponse.json({ error: "Unknown outcome" }, { status: 400 });

    const db = await getDb();
    const booking = await db.collection("bookings").findOne({
      _id: new ObjectId(bookingId),
      org_id: userId,
      visitor_id: visitorId,
      is_test: true,
    });
    if (!booking) return NextResponse.json({ error: "Test booking not found" }, { status: 404 });

    const result = await confirmTestBooking(db, booking, outcome);
    const current = (await db.collection("bookings").findOne({ _id: booking._id }))!;
    const id = bookingId;
    return NextResponse.json({
      success: result === "confirmed" || result === "failed" || result === "unchanged",
      result,
      status: current.status,
      ticket_page_url: current.status === "confirmed" ? ticketPageUrl(id, userId, visitorId) : undefined,
      ticket_pdf_url: current.status === "confirmed" ? ticketPdfUrl(id, userId, visitorId) : undefined,
    });
  } catch (error) {
    console.error("[test_pay]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
