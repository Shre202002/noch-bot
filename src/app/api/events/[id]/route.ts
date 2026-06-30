import { NextRequest, NextResponse } from "next/request";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);

    const event = await db.collection("events").findOne({
      _id: eventId,
      org_id: userId,
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const formFields = await db
      .collection("event_form_fields")
      .find({ event_id: eventId })
      .sort({ order_index: 1 })
      .toArray();

    return NextResponse.json({ success: true, data: { ...event, form_fields: formFields } });
  } catch (error) {
    console.error("[event_get_id]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const body = await req.json();

    const existing = await db.collection("events").findOne({
      _id: eventId,
      org_id: userId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Restriction check
    if (existing.status !== "draft") {
      if (body.allow_group_booking !== undefined || body.max_tickets_per_booking !== undefined) {
        return NextResponse.json(
          { error: "Cannot change group booking settings after publishing" },
          { status: 400 }
        );
      }
    }

    // Effective state calculation & validation
    const effective = {
      ...existing,
      ...body,
      start_at: body.start_at ? new Date(body.start_at) : existing.start_at,
      end_at: body.end_at ? new Date(body.end_at) : existing.end_at,
      capacity: body.capacity !== undefined ? Number(body.capacity) : existing.capacity,
      price: body.price !== undefined ? Number(body.price) : existing.price,
    };

    // NaN checks for numbers
    if (isNaN(effective.capacity)) return NextResponse.json({ error: "Invalid capacity value" }, { status: 400 });
    if (body.price !== undefined && isNaN(effective.price)) return NextResponse.json({ error: "Invalid price value" }, { status: 400 });
    if (isNaN(effective.start_at.getTime()) || isNaN(effective.end_at.getTime())) {
      return NextResponse.json({ error: "Invalid date values" }, { status: 400 });
    }

    // POST-like validations on effective state
    if (effective.end_at <= effective.start_at) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }
    if (effective.capacity < existing.tickets_sold) {
      return NextResponse.json({ error: `Cannot set capacity lower than tickets already sold (${existing.tickets_sold})` }, { status: 400 });
    }
    if (effective.is_paid && (effective.price === null || effective.price < 0)) {
      return NextResponse.json({ error: "Valid price is required for paid events" }, { status: 400 });
    }

    const updates: any = {};
    const allowedFields = [
      "name", "description", "start_at", "end_at", "venue", "capacity",
      "is_paid", "price", "currency", "ticket_template_id", "logo_url", "banner_url",
    ];

    if (existing.status === "draft") {
      allowedFields.push("allow_group_booking", "max_tickets_per_booking");
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "start_at" || field === "end_at") updates[field] = new Date(body[field]);
        else if (field === "capacity" || (field === "price" && body[field] !== null)) updates[field] = Number(body[field]);
        else updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    updates.updated_at = new Date();

    await db.collection("events").updateOne(
      { _id: eventId, org_id: userId },
      { $set: updates }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[event_patch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
