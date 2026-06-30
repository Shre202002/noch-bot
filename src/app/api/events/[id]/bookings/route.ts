import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(
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

    // 1. Verify event ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // 2. Parse Query Params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));

    // 3. Build Filter
    const query: any = { event_id: eventId };
    if (status) query.status = status;

    // 4. Fetch Bookings (Trimmed Projection)
    const [bookings, total] = await Promise.all([
      db.collection("bookings")
        .find(query)
        .project({
          _id: 1,
          status: 1,
          quantity: 1,
          amount_charged: 1,
          payment_provider: 1,
          created_at: 1
        })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection("bookings").countDocuments(query)
    ]);

    return NextResponse.json({ 
      success: true, 
      bookings, 
      total, 
      page, 
      limit 
    });
  } catch (error) {
    console.error("[bookings_get_list]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
