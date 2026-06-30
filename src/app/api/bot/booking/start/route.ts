import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { Booking } from "@/models/Booking";

export async function POST(req: NextRequest) {
  try {
    const { chatbot_widget_id } = await req.json();

    if (!chatbot_widget_id) {
      return NextResponse.json({ error: "Missing widget ID" }, { status: 400 });
    }

    if (!ObjectId.isValid(chatbot_widget_id)) {
      return NextResponse.json({ error: "Invalid widget ID" }, { status: 400 });
    }

    const db = await getDb();
    
    // Look up event by widget ID
    const event = await db.collection("events").findOne({ 
      chatbot_widget_id: new ObjectId(chatbot_widget_id),
      status: "published" 
    });

    if (!event) {
      // Generic 404 to avoid leaking existence of unpublished events
      return NextResponse.json({ error: "Booking session could not be started" }, { status: 404 });
    }

    // Check if event has already passed
    const now = new Date();
    if (event.end_at < now) {
      return NextResponse.json({ error: "This event has already ended" }, { status: 410 });
    }

    // Initialize session
    const sessionId = crypto.randomUUID();
    
    const newBooking: Booking = {
      event_id: event._id,
      session_id: sessionId,
      status: 'in_progress',
      quantity: 0,
      form_responses: {},
      conversation_state: 'collecting_quantity',
      session_context: {
        current_field_index: 0,
        current_attendee_index: 0,
        last_updated_at: now
      },
      amount_charged: null,
      payment_provider: 'none',
      payment_reference_id: null,
      created_at: now,
      updated_at: now
    };

    await db.collection("bookings").insertOne(newBooking);

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      event: {
        name: event.name,
        description: event.description,
        is_paid: event.is_paid,
        price: event.price,
        currency: event.currency,
        allow_group_booking: event.allow_group_booking,
        max_tickets_per_booking: event.max_tickets_per_booking
      }
    });

  } catch (error) {
    console.error("[bot_booking_start]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
