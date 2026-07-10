import { NextRequest, NextResponse } from "next/request";
import { getDb } from "@/lib/db";
import { BookingSession } from "@/models/BookingSession";
import { ObjectId } from "mongodb";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function serializeBookingSession(session: any) {
  return {
    session_id: session._id.toString(),
    event_id: session.event_id?.toString(),
    status: session.status,
    current_step: session.current_step,
    current_field_index: session.current_field_index || 0,
    quantity: session.quantity || 1,
    answers: session.answers || [],
    expires_at: session.expires_at instanceof Date ? session.expires_at.toISOString() : session.expires_at
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, visitorId, chatSessionId, eventId } = body;

    if (!userId || !visitorId) {
      return NextResponse.json({ error: "Missing required identity fields" }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();

    // 1. If eventId is provided, validate it exists and is published by this user
    let validEventId: ObjectId | undefined;
    if (eventId && ObjectId.isValid(eventId)) {
      const event = await db.collection("events").findOne({
        _id: new ObjectId(eventId),
        org_id: userId,
        status: "published"
      });
      if (!event) {
        return NextResponse.json({ error: "Selected event is not available" }, { status: 404, headers: corsHeaders });
      }
      if (new Date(event.end_at) < new Date()) {
        return NextResponse.json({ error: "Event has already ended" }, { status: 410, headers: corsHeaders });
      }
      validEventId = event._id;
    }

    // Check for existing active session
    let session = await db.collection("booking_sessions").findOne({
      org_id: userId,
      visitor_id: visitorId,
      status: { $in: ["started", "collecting_details", "summary"] },
      expires_at: { $gt: new Date() }
    });

    if (session) {
      if (validEventId) {
        await db.collection("booking_sessions").updateOne(
          { _id: session._id },
          { 
            $set: { 
              event_id: validEventId,
              current_step: "quantity",
              updated_at: new Date()
            }
          }
        );
        session = await db.collection("booking_sessions").findOne({ _id: session._id });
      }
    } else {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60000); // 30 mins

      const newSession: BookingSession = {
        org_id: userId,
        visitor_id: visitorId,
        chat_session_id: chatSessionId,
        status: "started",
        current_step: validEventId ? "quantity" : "select_event",
        event_id: validEventId,
        answers: [],
        current_field_index: 0,
        quantity: 1,
        created_at: now,
        updated_at: now,
        expires_at: expiresAt
      };

      const result = await db.collection("booking_sessions").insertOne(newSession);
      session = { ...newSession, _id: result.insertedId };
    }

    return NextResponse.json(serializeBookingSession(session), { headers: corsHeaders });
  } catch (error) {
    console.error("[post_session_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
