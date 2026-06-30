import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);

    // 1. Verify ownership and draft status
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (event.status !== "draft") {
      return NextResponse.json({ error: "Only draft events can be published" }, { status: 400 });
    }

    // 2. Validate form fields presence
    const fieldCount = await db.collection("event_form_fields").countDocuments({ event_id: eventId });
    if (fieldCount === 0) {
      return NextResponse.json({ error: "Event must have at least one form field before publishing" }, { status: 400 });
    }

    // 3. Validate payment gateway if event is paid
    if (event.is_paid) {
      const gateway = await db.collection("payment_gateway_configs").findOne({ org_id: userId, is_active: true });
      if (!gateway) {
        return NextResponse.json({ error: "Paid events require an active payment gateway configuration" }, { status: 400 });
      }
    }

    // 4. Finalize transition
    // Note: chatbot_widget_id is already an ObjectId created in the POST /api/events route.
    // This linkage can be further refined here if existing widget logic requires specific registration.

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
