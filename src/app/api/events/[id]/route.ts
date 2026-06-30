import { NextRequest, NextResponse } from "next/server";
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

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);

    const event = await db.collection("events").findOne({
      _id: eventId,
      org_id: new ObjectId(userId),
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const formFields = await db
      .collection("event_form_fields")
      .find({ event_id: eventId })
      .sort({ order_index: 1 })
      .toArray();

    return NextResponse.json({ ...event, form_fields: formFields });
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

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const body = await req.json();

    // Fetch existing state
    const existing = await db.collection("events").findOne({
      _id: eventId,
      org_id: new ObjectId(userId),
    });

    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updates: any = {};
    const allowedFields = [
      "name",
      "description",
      "start_at",
      "end_at",
      "venue",
      "capacity",
      "is_paid",
      "price",
      "currency",
      "ticket_template_id",
      "logo_url",
      "banner_url",
    ];

    // Draft-only restrictions
    if (existing.status !== "draft") {
      if (body.allow_group_booking !== undefined || body.max_tickets_per_booking !== undefined) {
        return NextResponse.json(
          { error: "Cannot change group booking settings after publishing" },
          { status: 400 }
        );
      }
    } else {
      allowedFields.push("allow_group_booking", "max_tickets_per_booking");
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Direct status or count updates are forbidden
    delete updates.status;
    delete updates.tickets_sold;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    updates.updated_at = new Date();

    await db.collection("events").updateOne(
      { _id: eventId, org_id: new ObjectId(userId) },
      { $set: updates }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[event_patch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
