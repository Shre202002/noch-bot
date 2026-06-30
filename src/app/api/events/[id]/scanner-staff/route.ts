import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getUserIdFromCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(
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

    const body = await req.json();
    const { name, email, org_wide } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // 2. Generate Access Token
    const accessToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(accessToken).digest('hex');

    // 3. Persist Staff Record
    const staffMember = {
      org_id: userId,
      event_id: org_wide ? null : eventId,
      name,
      email,
      access_token: hashedToken,
      created_at: new Date()
    };

    const result = await db.collection("scanner_staff").insertOne(staffMember);

    // 4. Return Plaintext Token ONCE
    return NextResponse.json({ 
      success: true, 
      staff_id: result.insertedId,
      access_token: accessToken,
      warning: "Save this token now — it will not be shown again and cannot be retrieved."
    });
  } catch (error) {
    console.error("[scanner_staff_post]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    // 2. List org-wide staff OR staff scoped to this specific event
    const staff = await db.collection("scanner_staff")
      .find({
        org_id: userId,
        $or: [
          { event_id: null },
          { event_id: eventId }
        ]
      })
      .project({ access_token: 0 }) // NEVER leak hash in list
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ success: true, data: staff });
  } catch (error) {
    console.error("[scanner_staff_get_list]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
