import { NextRequest, NextResponse } from "next/server";
import { authenticateScannerRequest } from "@/lib/scannerAuth";
import { getDb } from "@/lib/db";
import { scanTicket } from "@/lib/ticketScan";

if (!process.env.TICKET_QR_SECRET) {
  console.error("CRITICAL: TICKET_QR_SECRET is not configured for scanning routes.");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const routeParams = await params;
  if (!process.env.TICKET_QR_SECRET) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const staff = await authenticateScannerRequest(req);
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ticketCode } = routeParams;
    const body = await req.json();
    const { scan_device_info, client_scan_id } = body;

    const db = await getDb();
    const outcome = await scanTicket(db, {
      ticketCode,
      eventScope: staff.event_id ?? null,
      scannerId: staff._id,
      scannerName: staff.name ?? null,
      deviceInfo: scan_device_info,
      clientScanId: client_scan_id,
    });

    switch (outcome.code) {
      case "misconfigured":
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
      case "not_found":
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      case "test_ticket":
        return NextResponse.json({ error: "This is a test ticket", reason: "test_ticket" }, { status: 409 });
      case "wrong_event":
        return NextResponse.json({ error: "Not authorized for this event" }, { status: 403 });
      case "tampered":
        return NextResponse.json({ error: "Invalid or tampered ticket" }, { status: 400 });
      case "not_confirmed":
        return NextResponse.json({ error: "Cannot scan ticket", reason: "booking_not_confirmed" }, { status: 409 });
      case "not_active":
        return NextResponse.json(
          { error: "Cannot scan ticket", reason: outcome.status, scanned_at: outcome.scannedAt ?? undefined },
          { status: 409 }
        );
      case "scanned":
        return NextResponse.json(
          outcome.retry ? { success: true, ticket: outcome.ticket, details: "Retry accepted" } : { success: true, ticket: outcome.ticket }
        );
    }
  } catch (error) {
    console.error("[scanner_scan_single]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
