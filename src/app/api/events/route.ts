import { NextRequest, NextResponse } from "next/request";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Event } from "@/models/Event";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      description,
      start_at,
      end_at,
      venue,
      capacity,
      is_paid,
      price,
      currency,
      allow_group_booking,
      max_tickets_per_booking,
      ticket_template_id,
      logo_url,
      banner_url,
    } = body;

    // Validations
    if (!name || !description || !start_at || !end_at || capacity === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(start_at);
    const end = new Date(end_at);
    const capNum = Number(capacity);
    const priceNum = price !== undefined ? Number(price) : null;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    if (isNaN(capNum) || capNum <= 0) {
      return NextResponse.json({ error: "Capacity must be a number greater than 0" }, { status: 400 });
    }

    if (is_paid && (priceNum === null || isNaN(priceNum) || priceNum < 0)) {
      return NextResponse.json({ error: "Valid price is required for paid events" }, { status: 400 });
    }

    if (allow_group_booking && (!max_tickets_per_booking || isNaN(Number(max_tickets_per_booking)) || Number(max_tickets_per_booking) < 1)) {
      return NextResponse.json({ error: "Invalid max tickets per booking" }, { status: 400 });
    }

    const db = await getDb();
    const event: Event = {
      org_id: userId, // UUID string
      name,
      description,
      start_at: start,
      end_at: end,
      venue: venue || null,
      capacity: capNum,
      tickets_sold: 0,
      status: "draft",
      is_paid: !!is_paid,
      price: is_paid ? priceNum : null,
      currency: currency || "USD",
      allow_group_booking: !!allow_group_booking,
      max_tickets_per_booking: allow_group_booking ? Number(max_tickets_per_booking) : null,
      ticket_template_id: ticket_template_id || "default",
      logo_url: logo_url || null,
      banner_url: banner_url || null,
      chatbot_widget_id: new ObjectId(), // Placeholder
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection("events").insertOne(event);

    return NextResponse.json({ success: true, id: result.insertedId }, { status: 201 });
  } catch (error) {
    console.error("[events_post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromCookie();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    const db = await getDb();
    const query: any = { org_id: userId };
    if (status) query.status = status;

    const events = await db
      .collection("events")
      .find(query)
      .project({
        name: 1,
        status: 1,
        start_at: 1,
        tickets_sold: 1,
        capacity: 1,
        created_at: 1,
      })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error("[events_get]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
