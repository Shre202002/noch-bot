import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const events = await db.collection("events")
      .find({ 
        org_id: userId, 
        status: "published" 
      })
      .project({
        _id: 1,
        name: 1,
        description: 1,
        start_at: 1,
        end_at: 1,
        venue: 1,
        is_paid: 1,
        price: 1,
        currency: 1,
        capacity: 1,
        tickets_sold: 1,
        ticket_template_id: 1,
      })
      .sort({ start_at: 1 })
      .toArray();

    const formattedEvents = events.map(e => ({
      id: e._id.toString(),
      name: e.name,
      description: e.description,
      date: e.start_at,
      venue: e.venue,
      is_paid: e.is_paid,
      price: e.price,
      currency: e.currency,
      available_seats: Math.max(0, e.capacity - e.tickets_sold),
      ticket_template_id: e.ticket_template_id,
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
