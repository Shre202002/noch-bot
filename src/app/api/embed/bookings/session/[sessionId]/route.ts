import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, eventId, fieldId, value, quantity, userId, visitorId } = body;

    if (!userId || !visitorId) {
      return NextResponse.json({ error: "Missing identity" }, { status: 400, headers: corsHeaders });
    }

    const db = await getDb();

    const session = await db.collection("booking_sessions").findOne({ 
      _id: new ObjectId(sessionId),
      org_id: userId,
      visitor_id: visitorId,
      expires_at: { $gt: new Date() }
    });

    if (!session) {
      return NextResponse.json({ error: "Session expired or not found" }, { status: 404, headers: corsHeaders });
    }

    const updates: any = { updated_at: new Date() };

    if (action === "select_event") {
      if (!ObjectId.isValid(eventId)) return NextResponse.json({ error: "Invalid event ID" }, { status: 400, headers: corsHeaders });
      
      const event = await db.collection("events").findOne({ 
        _id: new ObjectId(eventId),
        org_id: userId,
        status: "published"
      });

      if (!event) return NextResponse.json({ error: "Event not available" }, { status: 404, headers: corsHeaders });
      if (new Date(event.end_at) < new Date()) return NextResponse.json({ error: "Event has already ended" }, { status: 410, headers: corsHeaders });

      updates.event_id = event._id;
      updates.current_step = "quantity";
      updates.selected_event_snapshot = {
        name: event.name,
        price: event.price,
        currency: event.currency,
        is_paid: event.is_paid
      };
    }

    if (action === "set_quantity") {
      const q = parseInt(quantity);
      if (isNaN(q) || q < 1) return NextResponse.json({ error: "Invalid quantity" }, { status: 400, headers: corsHeaders });
      
      const fields = await db.collection("event_form_fields")
        .find({ event_id: session.event_id })
        .sort({ order_index: 1 })
        .toArray();

      updates.quantity = q;
      if (fields.length === 0) {
        updates.current_step = "summary";
        updates.status = "summary";
      } else {
        updates.current_step = "collect_field";
        updates.status = "collecting_details";
        updates.current_field_index = 0;
      }
    }

    if (action === "answer_field") {
      const fields = await db.collection("event_form_fields")
        .find({ event_id: session.event_id })
        .sort({ order_index: 1 })
        .toArray();
      
      const currentField = fields[session.current_field_index];
      if (!currentField || currentField._id.toString() !== fieldId) {
        return NextResponse.json({ error: "Invalid field sequence" }, { status: 400, headers: corsHeaders });
      }
      
      if (currentField.is_required && (!value || String(value).trim() === "")) {
        return NextResponse.json({ error: `${currentField.label} is required` }, { status: 400, headers: corsHeaders });
      }

      // Validation Rules
      if (value) {
        const valStr = String(value).trim();
        if (currentField.validation_rule === 'email_format' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valStr)) {
          return NextResponse.json({ error: "Invalid email format" }, { status: 400, headers: corsHeaders });
        }
        if (currentField.validation_rule === 'phone_format' && !/^\+?[0-9]{7,15}$/.test(valStr)) {
          return NextResponse.json({ error: "Invalid phone format (7-15 digits)" }, { status: 400, headers: corsHeaders });
        }
        if (currentField.validation_rule === 'name_format' && valStr.length < 2) {
          return NextResponse.json({ error: "Name too short" }, { status: 400, headers: corsHeaders });
        }
        if (currentField.validation_rule === 'custom_regex' && currentField.custom_regex) {
          if (!new RegExp(currentField.custom_regex).test(valStr)) {
            return NextResponse.json({ error: "Input does not match requirements" }, { status: 400, headers: corsHeaders });
          }
        }
      }

      const newAnswers = [...(session.answers || [])];
      const existingIdx = newAnswers.findIndex(a => a.field_id === fieldId);
      const answerObj = {
        field_id: fieldId,
        label: currentField.label,
        field_type: currentField.field_type,
        validation_rule: currentField.validation_rule,
        custom_regex: currentField.custom_regex,
        value: value
      };

      if (existingIdx > -1) newAnswers[existingIdx] = answerObj;
      else newAnswers.push(answerObj);

      updates.answers = newAnswers;
      
      if (session.current_field_index < fields.length - 1) {
        updates.current_field_index = session.current_field_index + 1;
      } else {
        updates.current_step = "summary";
        updates.status = "summary";
      }
    }

    await db.collection("booking_sessions").updateOne(
      { _id: new ObjectId(sessionId) },
      { $set: updates }
    );

    const updatedSession = await db.collection("booking_sessions").findOne({ _id: new ObjectId(sessionId) });
    return NextResponse.json(serializeBookingSession(updatedSession), { headers: corsHeaders });

  } catch (error) {
    console.error("[patch_session_error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
