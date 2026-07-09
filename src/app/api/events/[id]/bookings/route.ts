import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const event = await db.collection("events").findOne({ _id: new ObjectId(id), org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const bookings = await db.collection("bookings")
      .find({ event_id: new ObjectId(id) })
      .sort({ created_at: -1 })
      .toArray();

    const result = bookings.map(b => ({
      id: b._id.toString(),
      booking_code: b.booking_code,
      attendee_name: b.attendee.answers.find(a => a.label.toLowerCase().includes('name'))?.value,
      attendee_email: b.attendee.answers.find(a => a.label.toLowerCase().includes('email'))?.value,
      quantity: b.quantity,
      amount_total: b.amount_total,
      status: b.status,
      payment_status: b.payment_status,
      created_at: b.created_at,
    }));

    return NextResponse.json({ bookings: result });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
