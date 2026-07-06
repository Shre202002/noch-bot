import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const body = await req.json(); // Array of { field_id, order_index }

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Payload must be an array of objects" }, { status: 400 });
    }

    // Ownership check
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const ops = body.map((item: any) => {
      if (!ObjectId.isValid(item.field_id)) throw new Error("Invalid field_id");
      return {
        updateOne: {
          filter: { _id: new ObjectId(item.field_id), event_id: eventId },
          update: { $set: { order_index: Number(item.order_index) } },
        },
      };
    });

    await db.collection("event_form_fields").bulkWrite(ops);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
