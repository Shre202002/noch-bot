import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateScannerRequest } from "@/lib/scannerAuth";
import { getDb } from "@/lib/db";

const TICKET_QR_SECRET = process.env.TICKET_QR_SECRET;

if (!TICKET_QR_SECRET) {
  console.error("CRITICAL: TICKET_QR_SECRET is not configured for scanning routes.");
}

export async function POST(req: NextRequest) {
  if (!TICKET_QR_SECRET) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const staff = await authenticateScannerRequest(req);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { scans } = await req.json();
    if (!Array.isArray(scans)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const db = await getDb();
    const results = [];

    for (const scan of scans) {
      const { ticket_code, scanned_at, scan_device_info, client_scan_id } = scan;
      
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
              client_scan_id: client_scan_id || null,
            }
          }
        );

        if (update) {
          results.push({ ticket_code, result: "accepted" });
        } else {
          // Already scanned - check for ID-based retry or timestamp conflict
          const existing = await db.collection("tickets").findOne({ ticket_code });
          
          if (existing?.status === "scanned") {
            // 1. Check if this is a safe retry of the same attempt
            if (client_scan_id && existing.client_scan_id === client_scan_id) {
               results.push({ ticket_code, result: "accepted", details: "Retry accepted" });
               continue;
            }

            // 2. Otherwise handle as conflict
            const existingTime = new Date(existing.scanned_at).getTime();
            const attemptTime = clientTimestamp.getTime();

            if (existingTime < attemptTime) {
              results.push({ 
                ticket_code, 
                result: "duplicate_conflict", 
                details: `Already scanned at ${existing.scanned_at}` 
              });
            } else {
              // This should theoretically not happen if sync order matches real time, 
              // unless there is clock skew between devices.
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
