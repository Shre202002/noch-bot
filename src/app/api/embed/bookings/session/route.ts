import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { BookingSession } from "@/models/BookingSession";
import { ObjectId } from "mongodb";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, visitorId, chatSessionId, eventId } = body;

    if (!userId || !visitorId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();

    // Check for existing active session
    let session = await db.collection("booking_sessions").findOne({
      org_id: userId,
      visitor_id: visitorId,
      status: { $in: ["started", "collecting_details", "summary"] },
      expires_at: { $gt: new Date() }
    });

    if (session) {
      if (eventId && ObjectId.isValid(eventId)) {
        await db.collection("booking_sessions").updateOne(
          { _id: session._id },
          { 
            $set: { 
              event_id: new ObjectId(eventId),
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
        current_step: eventId ? "quantity" : "select_event",
        event_id: eventId && ObjectId.isValid(eventId) ? new ObjectId(eventId) : undefined,
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

    return NextResponse.json({
      session_id: session!._id!.toString(),
      status: session!.status,
      current_step: session!.current_step,
      event_id: session!.event_id?.toString(),
      expires_at: session!.expires_at,
    }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}