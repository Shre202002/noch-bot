import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { action, eventId, fieldId, value, quantity } = body;
    const db = await getDb();

    const session = await db.collection("booking_sessions").findOne({ 
      _id: new ObjectId(sessionId),
      expires_at: { $gt: new Date() }
    });

    if (!session) {
      return NextResponse.json({ error: "Session expired or not found" }, { status: 404 });
    }

    const updates: any = { updated_at: new Date() };

    if (action === "select_event") {
      if (!ObjectId.isValid(eventId)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
      updates.event_id = new ObjectId(eventId);
      updates.current_step = "quantity";
    }

    if (action === "set_quantity") {
      const q = parseInt(quantity);
      if (isNaN(q) || q < 1) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
      updates.quantity = q;
      updates.current_step = "collect_field";
      updates.status = "collecting_details";
    }

    if (action === "answer_field") {
      const fields = await db.collection("event_form_fields")
        .find({ event_id: session.event_id })
        .sort({ order_index: 1 })
        .toArray();
      
      const currentField = fields[session.current_field_index];
      
      // Validation
      if (currentField.is_required && !value) {
        return NextResponse.json({ error: `${currentField.label} is required` }, { status: 400 });
      }

      // Add to answers
      const newAnswers = [...(session.answers || [])];
      const existingIdx = newAnswers.findIndex(a => a.field_id === fieldId);
      const answerObj = {
        field_id: fieldId,
        label: currentField.label,
        field_type: currentField.field_type,
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
    return NextResponse.json(updatedSession);

  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
