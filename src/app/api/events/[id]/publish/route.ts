import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { describeMissing, eventReadiness } from "@/lib/eventReadiness";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(routeParams.id)) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(routeParams.id);

    // 1. Verify ownership and draft status
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (event.status !== "draft") {
      return NextResponse.json({ error: "Only draft events can be published" }, { status: 400 });
    }

    // 2. Everything the organizer must finish first. The event page reads the same rules (eventReadiness), so a
    // Publish button that is enabled there can never be refused here for a reason the page did not show.
    const [fieldCount, gateway] = await Promise.all([
      db.collection("event_form_fields").countDocuments({ event_id: eventId }),
      event.is_paid
        ? db.collection("payment_gateway_configs").findOne({ org_id: userId, is_active: true })
        : Promise.resolve(null),
    ]);
    const readiness = eventReadiness(event as never, { fieldCount, gatewayActive: !!gateway });
    if (!readiness.complete) {
      return NextResponse.json(
        {
          error: `Finish before going live: ${describeMissing(readiness.missing)}.`,
          missing: readiness.missing.map((m) => ({ id: m.id, label: m.label, tab: m.tab })),
        },
        { status: 400 }
      );
    }

    // 3. Finalize transition
    await db.collection("events").updateOne(
      { _id: eventId, org_id: userId },
      { 
        $set: { 
          status: "published",
          updated_at: new Date()
        } 
      }
    );

    return NextResponse.json({ success: true, status: "published" });
  } catch (error) {
    console.error("[event_publish]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

