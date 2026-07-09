import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

const HEX_REGEX = /^#([0-9A-Fa-f]{6})$/;

/**
 * Saves ticket design configuration including template and color palette.
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

    const { template_id, color_palette } = body;

    // Verify ownership
    const event = await db.collection("events").findOne({ _id: eventId, org_id: userId });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const updates: any = {
      updated_at: new Date()
    };

    if (template_id) {
      updates.ticket_template_id = template_id;
    }

    if (color_palette) {
      // Validate hex colors
      for (const [key, value] of Object.entries(color_palette)) {
        if (typeof value !== 'string' || !HEX_REGEX.test(value)) {
          return NextResponse.json({ error: `Invalid color format for ${key}` }, { status: 400 });
        }
      }
      updates.ticket_color_palette = color_palette;
    }

    await db.collection("events").updateOne(
      { _id: eventId, org_id: userId },
      { $set: updates }
    );

    const updatedEvent = await db.collection("events").findOne({ _id: eventId });

    return NextResponse.json({ 
      success: true,
      ticket_design: {
        template_id: updatedEvent?.ticket_template_id,
        color_palette: updatedEvent?.ticket_color_palette
      }
    });
  } catch (error) {
    console.error("[ticket_design_patch]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
