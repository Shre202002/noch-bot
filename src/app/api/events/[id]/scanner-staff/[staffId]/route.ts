import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string, staffId: string } }
) {
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(params.id) || !ObjectId.isValid(params.staffId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(params.id);
    const staffId = new ObjectId(params.staffId);

    // 1. Verify event ownership (to authorize the action)
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    // 2. Delete staff record (must belong to this org)
    const result = await db.collection("scanner_staff").deleteOne({ 
      _id: staffId, 
      org_id: userId 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[scanner_staff_delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
