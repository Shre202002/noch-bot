import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateScannerRequest } from "@/lib/scannerAuth";
import { getDb } from "@/lib/db";

const TICKET_QR_SECRET = process.env.TICKET_QR_SECRET;

export async function POST(req: NextRequest) {
  const staff = await authenticateScannerRequest(req);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { scans } = await req.json();
    if (!Array.isArray(scans)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const db = await getDb();
    const results = [];

    for (const scan of scans) {
      const { ticket_code, scanned_at, scan_device_info } = scan;
      
      try {
        const ticket = await db.collection("tickets").findOne({ ticket_code });
        
        if (!ticket) {
          results.push({ ticket_code, result: "invalid", details: "Ticket not found" });
          continue;
        }

        // Scope check
        if (staff.event_id && !staff.event_id.equals(ticket.event_id)) {
          results.push({ ticket_code, result: "invalid", details: "Unauthorized event" });
          continue;
        }

        // HMAC verification
        const expectedHash = crypto
          .createHmac("sha256", TICKET_QR_SECRET!)
          .update(`${ticket_code}:${ticket.booking_id}:${ticket.event_id}`)
          .digest("hex");

        if (ticket.qr_payload_hash !== expectedHash) {
          results.push({ ticket_code, result: "invalid", details: "Tampered hash" });
          continue;
        }

        // Atomic claim with client timestamp
        const clientTimestamp = new Date(scanned_at);
        const update = await db.collection("tickets").findOneAndUpdate(
          { ticket_code, status: "active" },
          {
            $set: {
              status: "scanned",
              scanned_at: clientTimestamp,
              scanned_by_staff_id: staff._id,
              scan_device_info: scan_device_info || null,
            }
          }
        );

        if (update) {
          results.push({ ticket_code, result: "accepted" });
        } else {
          // Already scanned - check for conflict
          const existing = await db.collection("tickets").findOne({ ticket_code });
          if (existing?.status === "scanned") {
            const existingTime = new Date(existing.scanned_at).getTime();
            const attemptTime = clientTimestamp.getTime();

            if (existingTime < attemptTime) {
              results.push({ 
                ticket_code, 
                result: "duplicate_conflict", 
                details: `Already scanned at ${existing.scanned_at}` 
              });
            } else if (existingTime === attemptTime && existing.scanned_by_staff_id?.equals(staff._id)) {
              results.push({ ticket_code, result: "accepted", details: "Retry successful" });
            } else {
              console.warn(`[scanner_sync_skew] Batch attempt ${attemptTime} is EARLIER than DB ${existingTime} for ${ticket_code}`);
              results.push({ ticket_code, result: "duplicate_conflict", details: "Ticket already scanned" });
            }
          } else {
            results.push({ ticket_code, result: "invalid", details: `Status: ${existing?.status}` });
          }
        }
      } catch (innerError) {
        results.push({ ticket_code, result: "error", details: "Internal processing error" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[scanner_sync_batch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
