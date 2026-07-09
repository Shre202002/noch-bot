import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { readKnowledge, findAccountById } from "@/lib/storage";
import { embedText } from "@/lib/embeddings";
import { qdrant, ensureCollection, COLLECTION } from "@/lib/qdrant";
import {
  createOrFindConversation,
  saveMessage,
  updateConversationStats,
} from "@/lib/conversations";
import { checkMessageLimit } from "@/lib/ratelimit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const BOOKING_KEYWORDS = ["book", "ticket", "register", "attend", "reserve", "seat", "buy"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      messages,
      userId,
      sessionId,
      visitorId = "anonymous",
      sourceUrl = "",
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400, headers: corsHeaders });
    }

    const userMessage = messages[messages.length - 1]?.content || "";
    const lowerMsg = userMessage.toLowerCase();
    
    // Intent Detection for Booking
    const isBookingIntent = BOOKING_KEYWORDS.some(k => lowerMsg.includes(lowerMsg.includes('help') ? '____' : k));
    
    // Derby conversation website
    const website = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname; } catch { return "unknown"; } })() : "unknown";
    const effectiveSessionId = sessionId || `auto_${userId}_${Date.now()}`;

    // Rate Limit Check
    const account = await findAccountById(userId);
    const plan = account?.plan || "free";
    const rateCheck = await checkMessageLimit(userId, plan);

    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Limit reached", rateLimited: true }, { status: 429, headers: corsHeaders });
    }

    // Knowledge Search (RAG)
    let contextText = "";
    try {
      await ensureCollection();
      const queryVector = await embedText(userMessage);
      const searchResult = await qdrant.search(COLLECTION, {
        vector: queryVector,
        limit: 5,
        filter: { must: [{ key: "userId", match: { value: userId } }] },
      });
      contextText = searchResult.map((r) => (r.payload?.text as string) || "").filter(Boolean).join("\n\n");
    } catch {}

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: `You are the AI assistant for this website. Use context: ${contextText}` },
        ...messages
      ],
      temperature: 0.4,
    });

    const text = completion.choices[0]?.message?.content || "No response.";

    // Determine Action
    let action = null;
    if (isBookingIntent) {
      action = { type: "START_BOOKING" };
    }

    // Save to DB
    const conversationId = await createOrFindConversation(userId, effectiveSessionId, visitorId, website);
    await saveMessage({ userId, conversationId, sessionId: effectiveSessionId, role: "user", content: userMessage });
    await saveMessage({ userId, conversationId, sessionId: effectiveSessionId, role: "assistant", content: text, responseTimeMs: Date.now() - startTime });
    await updateConversationStats(conversationId);

    return NextResponse.json({ text, action, usage: rateCheck }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: corsHeaders });
  }
}
