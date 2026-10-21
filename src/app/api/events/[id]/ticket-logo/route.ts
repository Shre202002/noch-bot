import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildLogoUpdates } from "@/lib/ticketEmblems";

/**
 * Saves ticket logo configuration to an event.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeParams = await params;
  const userId = await getUserIdFromCookie();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ObjectId.isValid(routeParams.id)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const eventId = new ObjectId(routeParams.id);
    const body = await req.json();

    // Only the fields that were sent are changed, so toggling background removal or choosing an emblem
    // never erases an uploaded logo.
    const built = buildLogoUpdates(body);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

    // Verify ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const updates: Record<string, unknown> = { ...built.updates, updated_at: new Date() };

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

