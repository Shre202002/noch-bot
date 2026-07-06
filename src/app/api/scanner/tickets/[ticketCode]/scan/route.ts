import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateScannerRequest } from "@/lib/scannerAuth";
import { getDb } from "@/lib/db";

const TICKET_QR_SECRET = process.env.TICKET_QR_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { ticketCode: string } }
) {
  const staff = await authenticateScannerRequest(req);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ticketCode } = params;
    const body = await req.json();
    const { scan_device_info } = body;

    const db = await getDb();

    // 1. Fetch Ticket
    const ticket = await db.collection("tickets").findOne({ ticket_code: ticketCode });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

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
        }
      },
      { returnDocument: "after" }
    );

    if (!result) {
      // Re-fetch to see why it failed
      const stale = await db.collection("tickets").findOne({ ticket_code: ticketCode });
      return NextResponse.json({ 
        error: "Cannot scan ticket",
        reason: stale?.status || "unknown",
        scanned_at: stale?.scanned_at,
      }, { status: 409 });
    }

    return NextResponse.json({ success: true, ticket: result });
  } catch (error) {
    console.error("[scanner_scan_single]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
