import { NextRequest, NextResponse } from "next/server";
import { availableSeats } from "@/lib/eventsForChat";
import { getDb } from "@/lib/db";
import { getUserIdFromCookie } from "@/lib/auth";
import { isOwnerTestRequest, readyEventsForTest } from "@/lib/testBooking";

export const dynamic = 'force-dynamic';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400, headers: corsHeaders });
  }

  try {
    const db = await getDb();
    // Test mode is for the signed-in organizer only: it lists their complete events, drafts included.
    const test = isOwnerTestRequest(await getUserIdFromCookie().catch(() => null), userId, searchParams.get('test'));
    const events = test ? await readyEventsForTest(db, userId) : await db.collection("events")
      .find({
        org_id: userId,
        status: "published",
        end_at: { $gt: new Date() }
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
        tickets_held: 1,
        allow_group_booking: 1,
        max_tickets_per_booking: 1,
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
      available_seats: availableSeats(e as any),
      max_tickets_per_booking: e.allow_group_booking === false ? 1 : (e.max_tickets_per_booking ?? null),
      ticket_template_id: e.ticket_template_id,
    }));

    return NextResponse.json({ events: formattedEvents, test }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}