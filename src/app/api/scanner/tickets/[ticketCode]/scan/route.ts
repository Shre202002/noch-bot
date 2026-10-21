import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateScannerRequest } from "@/lib/scannerAuth";
import { getDb } from "@/lib/db";

const TICKET_QR_SECRET = process.env.TICKET_QR_SECRET;

if (!TICKET_QR_SECRET) {
  console.error("CRITICAL: TICKET_QR_SECRET is not configured for scanning routes.");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const routeParams = await params;
  if (!TICKET_QR_SECRET) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const staff = await authenticateScannerRequest(req);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ticketCode } = routeParams;
    const body = await req.json();
    const { scan_device_info, client_scan_id } = body;

    const db = await getDb();

    // 1. Fetch Ticket
    const ticket = await db.collection("tickets").findOne({ ticket_code: ticketCode });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Test tickets (made to try the booking) never admit anyone.
    if (ticket.is_test) {
      return NextResponse.json({ error: "This is a test ticket", reason: "test_ticket" }, { status: 409 });
    }

    // 2. Scoping Check
    if (staff.event_id && !staff.event_id.equals(ticket.event_id)) {
      return NextResponse.json({ error: "Not authorized for this event" }, { status: 403 });
    }

    // 3. Forgery Check
    const expectedHash = crypto
      .createHmac("sha256", TICKET_QR_SECRET!)
      .update(`${ticketCode}:${ticket.booking_id}:${ticket.event_id}`)
      .digest("hex");

    if (ticket.qr_payload_hash !== expectedHash) {
      return NextResponse.json({ error: "Invalid or tampered ticket" }, { status: 400 });
    }

    // 3b. Only tickets of confirmed bookings admit anyone (e.g. not one refunded after a late payment).
    const owningBooking = await db.collection("bookings").findOne(
      { _id: ticket.booking_id },
      { projection: { status: 1 } }
    );
    if (owningBooking && owningBooking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Cannot scan ticket", reason: "booking_not_confirmed" },
        { status: 409 }
      );
    }

    // 4. Atomic Claim
    const now = new Date();
    const result = await db.collection("tickets").findOneAndUpdate(
      { ticket_code: ticketCode, status: "active" },
      {
        $set: {
          status: "scanned",
          scanned_at: now,
          scanned_by_staff_id: staff._id,
          scan_device_info: scan_device_info || null,
          client_scan_id: client_scan_id || null,
        }
      },
      { returnDocument: "after" }
    );

    if (!result) {
      // Re-fetch to see why it failed (retry check)
      const existing = await db.collection("tickets").findOne({ ticket_code: ticketCode });

      if (existing?.status === "scanned" && client_scan_id && existing.client_scan_id === client_scan_id) {
         return NextResponse.json({ success: true, ticket: existing, details: "Retry accepted" });
      }

      return NextResponse.json({
        error: "Cannot scan ticket",
        reason: existing?.status || "unknown",
        scanned_at: existing?.scanned_at,
      }, { status: 409 });
    }

    return NextResponse.json({ success: true, ticket: result });
  } catch (error) {
    console.error("[scanner_scan_single]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


