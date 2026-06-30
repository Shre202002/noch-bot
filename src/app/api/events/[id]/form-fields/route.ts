import { NextRequest, NextResponse } from "next/request";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { EventFormField } from "@/models/EventFormField";

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

    // Verify ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const body = await req.json();
    const { field_key, label, field_type, options, is_required, validation_rule, custom_regex, ai_correction_enabled } = body;

    if (!field_key || !label || !field_type) {
      return NextResponse.json({ error: "Missing required form field data" }, { status: 400 });
    }

    // Validate field_key is valid identifier
    if (!/^[a-zA-Z0-9_]+$/.test(field_key)) {
      return NextResponse.json({ error: "field_key must be alphanumeric/underscores only" }, { status: 400 });
    }

    // Unique key check
    const existingField = await db.collection("event_form_fields").findOne({ event_id: eventId, field_key });
    if (existingField) {
      return NextResponse.json({ error: "A field with this key already exists for this event" }, { status: 409 });
    }

    // Regex validation
    if (validation_rule === "custom_regex") {
      if (!custom_regex) return NextResponse.json({ error: "custom_regex is required for this validation rule" }, { status: 400 });
      try { new RegExp(custom_regex); } catch { return NextResponse.json({ error: "Invalid regex pattern" }, { status: 400 }); }
    }

    // Assign order index
    const lastField = await db.collection("event_form_fields")
      .find({ event_id: eventId })
      .sort({ order_index: -1 })
      .limit(1)
      .toArray();
    const nextIndex = lastField.length > 0 ? lastField[0].order_index + 1 : 0;

    const newField: EventFormField = {
      event_id: eventId,
      field_key,
      label,
      field_type,
      options: options || null,
      is_required: !!is_required,
      validation_rule: validation_rule || "none",
      custom_regex: custom_regex || null,
      order_index: body.order_index !== undefined ? body.order_index : nextIndex,
      ai_correction_enabled: !!ai_correction_enabled,
    };

    const result = await db.collection("event_form_fields").insertOne(newField);

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("[form_fields_post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
