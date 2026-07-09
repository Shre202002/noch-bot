import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Saves ticket logo configuration to an event.
 */
export async function PATCH(
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
    const body = await req.json();

    const { logo_url, logo_file_id, remove_background, bg_removed_logo_url } = body;

    // Verify ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const updates: any = {
      logo_url: logo_url || null,
      logo_file_id: logo_file_id || null,
      remove_background: !!remove_background,
      bg_removed_logo_url: bg_removed_logo_url || null,
      updated_at: new Date()
    };

    await db.collection("events").updateOne(
      { _id: eventId, org_id: userId },
      { $set: updates }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ticket_logo_patch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
