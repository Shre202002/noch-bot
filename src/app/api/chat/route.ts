// import { NextRequest, NextResponse } from "next/server";
// import Groq from "groq-sdk";
// import { readKnowledge } from "@/lib/storage";
// import { embedText } from "@/lib/embeddings";
// import { qdrant, ensureCollection, COLLECTION } from "@/lib/qdrant";
// import {
//   createOrFindConversation,
//   saveMessage,
//   updateConversationStats,
// } from "@/lib/conversations";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type",
// };

// export async function OPTIONS() {
//   return new NextResponse(null, { status: 204, headers: corsHeaders });
// }

// export async function POST(req: NextRequest) {
//   const startTime = Date.now();

//   try {
//     const body = await req.json();
//     const {
//       messages,
//       userId,
//       sessionId,
//       visitorId = "anonymous",
//       sourceUrl = "",
//       metadata = {},
//     } = body;

//     if (!userId) {
//       return NextResponse.json(
//         { error: "Missing userId" },
//         { status: 400, headers: corsHeaders }
//       );
//     }

//     const userMessage = messages[messages.length - 1]?.content || "";

//     // Derive website from sourceUrl
//     const website = sourceUrl
//       ? (() => { try { return new URL(sourceUrl).hostname; } catch { return sourceUrl; } })()
//       : "unknown";

//     const effectiveSessionId = sessionId || `auto_${userId}_${Date.now()}`;

//     // ── Step 1: Save user message to MongoDB ─────────────────
//     let conversationId: string | null = null;
//     try {
//       conversationId = await createOrFindConversation(
//         userId,
//         effectiveSessionId,
//         visitorId,
//         website
//       );
//       await saveMessage({
//         userId,
//         conversationId,
//         sessionId: effectiveSessionId,
//         role: "user",
//         content: userMessage,
//         sourceUrl,
//         metadata,
//       });
//       await updateConversationStats(conversationId);
//     } catch (err) {
//       console.error("[chat] DB write failed:", err);
//     }

//     // ── Step 2: Load knowledge config ────────────────────────
//     const knowledge = await readKnowledge(userId);

//     // ── Step 3: RAG — embed + Qdrant search ──────────────────
//     let contextText = "";
//     try {
//       await ensureCollection();
//       const queryVector = await embedText(userMessage);
//       console.log("Query vector length:", queryVector.length);

//       const searchResult = await qdrant.search(COLLECTION, {
//         vector: queryVector,
//         limit: 5,
//         with_payload: true,
//         filter: {
//           must: [{ key: "userId", match: { value: userId } }],
//         },
//       });

//       if (searchResult.length > 0) {
//         contextText = searchResult
//           .map((r) => (r.payload?.text as string) || "")
//           .filter(Boolean)
//           .join("\n\n");
//       }
//     } catch (err) {
//       console.warn("[chat] RAG search failed:", err);
//     }

//     console.log("🔍 RAG context length:", contextText.length);

//     // ── Step 4: Build system prompt ───────────────────────────
//     const finalSystemPrompt = contextText
//       ? `You are the AI assistant for this website.

// Your role is to help users understand the website, products, services, and business using ONLY the information provided below.

// STRICT RULES:
// - Only answer using the website information below
// - Never invent information
// - Never mention OpenAI, ChatGPT, Claude, Anthropic, Gemini, or AI platforms
// - Never describe yourself as a generic AI assistant
// - If the answer is not available in the website information, say: "I couldn't find that information on this website."

// RESPONSE STYLE:
// - Keep responses concise and professional
// - Speak naturally like a premium customer support assistant
// - Never use markdown formatting
// - Never use **asterisks**
// - Never use bullet points or numbered lists unless explicitly requested
// - Prefer short conversational paragraphs
// - Avoid sounding robotic or overly enthusiastic

// WEBSITE INFORMATION:
// ${contextText}`
//       : `You are the AI assistant for this website.
// You currently do not have enough website information available.
// Politely respond: "I don't have enough website information yet to answer that."
// Suggest the user contact the website owner directly for more information.`;

//     // ── Step 5: Groq — plain JSON (no SSE) ───────────────────
//     const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//     const completion = await groq.chat.completions.create({
//       model: "llama-3.3-70b-versatile",
//       messages: [
//         { role: "system", content: finalSystemPrompt },
//         ...messages.map((m: { role: string; content: string }) => ({
//           role: m.role as "user" | "assistant",
//           content: m.content,
//         })),
//       ],
//       temperature: 0.4,
//       max_tokens: 700,
//     });

//     const text =
//       completion.choices[0]?.message?.content ||
//       "Sorry, I could not generate a response.";

//     const responseTimeMs = Date.now() - startTime;

//     // ── Step 6: Save assistant message to MongoDB ─────────────
//     if (conversationId) {
//       try {
//         await saveMessage({
//           userId,
//           conversationId,
//           sessionId: effectiveSessionId,
//           role: "assistant",
//           content: text,
//           responseTimeMs,
//           sourceUrl,
//           metadata,
//         });
//         await updateConversationStats(conversationId);
//       } catch (err) {
//         console.error("[chat] save assistant message failed:", err);
//       }
//     }

//     return NextResponse.json(
//       { text, conversationId, sessionId: effectiveSessionId },
//       { headers: corsHeaders }
//     );
//   } catch (err: any) {
//     console.error("[chat] error:", err);
//     return NextResponse.json(
//       { error: err?.message || "Internal server error" },
//       { status: 500, headers: corsHeaders }
//     );
//   }
// }


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
      metadata = {},
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Step 1: Get user plan + check rate limit ──────────────
    const account = await findAccountById(userId);
    const plan = account?.plan || "free";

    const rateCheck = await checkMessageLimit(userId, plan);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Monthly message limit reached (${rateCheck.used}/${rateCheck.limit}). Resets on ${rateCheck.resetDate}. Please upgrade your plan.`,
          rateLimited: true,
          used: rateCheck.used,
          limit: rateCheck.limit,
          resetDate: rateCheck.resetDate,
        },
        { status: 429, headers: corsHeaders }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || "";

    // Derive website from sourceUrl
    const website = sourceUrl
      ? (() => { try { return new URL(sourceUrl).hostname; } catch { return sourceUrl; } })()
      : "unknown";

    const effectiveSessionId = sessionId || `auto_${userId}_${Date.now()}`;

    // ── Step 2: Save user message to MongoDB ──────────────────
    let conversationId: string | null = null;
    try {
      conversationId = await createOrFindConversation(
        userId,
        effectiveSessionId,
        visitorId,
        website
      );
      await saveMessage({
        userId,
        conversationId,
        sessionId: effectiveSessionId,
        role: "user",
        content: userMessage,
        sourceUrl,
        metadata,
      });
      await updateConversationStats(conversationId);
    } catch (err) {
      console.error("[chat] DB write failed:", err);
    }

    // ── Step 3: Load knowledge config ─────────────────────────
    const knowledge = await readKnowledge(userId);

    // ── Step 4: RAG — embed + Qdrant search ───────────────────
    let contextText = "";
    try {
      await ensureCollection();
      const queryVector = await embedText(userMessage);
      console.log("Query vector length:", queryVector.length);

      const searchResult = await qdrant.search(COLLECTION, {
        vector: queryVector,
        limit: 5,
        with_payload: true,
        filter: {
          must: [{ key: "userId", match: { value: userId } }],
        },
      });

      if (searchResult.length > 0) {
        contextText = searchResult
          .map((r) => (r.payload?.text as string) || "")
          .filter(Boolean)
          .join("\n\n");
      }
    } catch (err) {
      console.warn("[chat] RAG search failed:", err);
    }

    console.log("🔍 RAG context length:", contextText.length);
    console.log(`📊 Rate limit: ${rateCheck.used + 1}/${rateCheck.limit} (${plan} plan)`);

    // ── Step 5: Build system prompt ───────────────────────────
    const finalSystemPrompt = contextText
      ? `You are the AI assistant for this website.

Your role is to help users understand the website, products, services, and business using ONLY the information provided below.

STRICT RULES:
- Only answer using the website information below
- Never invent information
- Never mention OpenAI, ChatGPT, Claude, Anthropic, Gemini, or AI platforms
- Never describe yourself as a generic AI assistant
- If the answer is not available in the website information, say: "I couldn't find that information on this website."

RESPONSE STYLE:
- Keep responses concise and professional
- Speak naturally like a premium customer support assistant
- Never use markdown formatting
- Never use **asterisks**
- Never use bullet points or numbered lists unless explicitly requested
- Prefer short conversational paragraphs
- Avoid sounding robotic or overly enthusiastic

WEBSITE INFORMATION:
${contextText}`
      : `You are the AI assistant for this website.
You currently do not have enough website information available.
Politely respond: "I don't have enough website information yet to answer that."
Suggest the user contact the website owner directly for more information.`;

    // ── Step 6: Groq generation ───────────────────────────────
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.4,
      max_tokens: 700,
    });

    const text =
      completion.choices[0]?.message?.content ||
      "Sorry, I could not generate a response.";

    const responseTimeMs = Date.now() - startTime;

    // ── Step 7: Save assistant message ───────────────────────
    if (conversationId) {
      try {
        await saveMessage({
          userId,
          conversationId,
          sessionId: effectiveSessionId,
          role: "assistant",
          content: text,
          responseTimeMs,
          sourceUrl,
          metadata,
        });
        await updateConversationStats(conversationId);
      } catch (err) {
        console.error("[chat] save assistant message failed:", err);
      }
    }

    return NextResponse.json(
      {
        text,
        conversationId,
        sessionId: effectiveSessionId,
        // Return usage info so dashboard can show it
        usage: {
          used: rateCheck.used + 1,
          limit: rateCheck.limit,
          plan,
          resetDate: rateCheck.resetDate,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}