import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.fieldId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const fieldId = new ObjectId(params.fieldId);

    // Ownership check
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const body = await req.json();
    const updates: any = {};
    const allowed = ["label", "field_type", "options", "is_required", "validation_rule", "custom_regex", "ai_correction_enabled"];

    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    if (updates.validation_rule === "custom_regex" && updates.custom_regex) {
      try { new RegExp(updates.custom_regex); } catch { return NextResponse.json({ error: "Invalid regex" }, { status: 400 }); }
    }

    const result = await db.collection("event_form_fields").updateOne(
      { _id: fieldId, event_id: eventId },
      { $set: updates }
    );

    if (result.matchedCount === 0) return NextResponse.json({ error: "Field not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.fieldId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const fieldId = new ObjectId(params.fieldId);

    // Ownership check
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // Block deletion if bookings exist
    const bookingsCount = await db.collection("bookings").countDocuments({ event_id: eventId });
    if (bookingsCount > 0) {
      return NextResponse.json({ error: "Cannot delete field from an event that already has bookings" }, { status: 409 });
    }

    const result = await db.collection("event_form_fields").deleteOne({ _id: fieldId, event_id: eventId });
    if (result.deletedCount === 0) return NextResponse.json({ error: "Field not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
