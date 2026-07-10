import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400, headers: corsHeaders });
  }

  try {
    const db = await getDb();
    const event = await db.collection("events").findOne({ 
      _id: new ObjectId(id),
      org_id: userId,
      status: "published"
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404, headers: corsHeaders });
    }

    const fields = await db.collection("event_form_fields")
      .find({ event_id: event._id })
      .sort({ order_index: 1 })
      .toArray();

    return NextResponse.json({
      event: {
        id: event._id.toString(),
        name: event.name,
        description: event.description,
        date: event.start_at,
        venue: event.venue,
        is_paid: event.is_paid,
        price: event.price,
        currency: event.currency,
        available_seats: Math.max(0, event.capacity - event.tickets_sold),
      },
      fields: fields.map(f => ({
        id: f._id.toString(),
        label: f.label,
        field_type: f.field_type,
        is_required: f.is_required,
        validation_rule: f.validation_rule,
        custom_regex: f.custom_regex,
        options: f.options,
        order_index: f.order_index,
      }))
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}