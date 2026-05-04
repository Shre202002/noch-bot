import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { readKnowledge } from "@/lib/storage";
import { embedText } from "@/lib/embeddings";
import { qdrant, ensureCollection, COLLECTION } from "@/lib/qdrant";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const userMessage = messages[messages.length - 1]?.content || "";

    // Load knowledge config (system prompt, bot name, etc.)
    const knowledge = await readKnowledge(userId);
    const systemPrompt = knowledge?.systemPrompt || "You are a helpful assistant.";

    // RAG: embed the query and search Qdrant for relevant chunks
    let contextText = "";
    try {
      await ensureCollection();
      const queryVector = await embedText(userMessage);
      console.log("Query vector length:", queryVector.length);
      const info = await qdrant.getCollection(COLLECTION);
      console.log(info);
      const searchResult = await qdrant.search(COLLECTION, {
        vector: {
          name: "default",
          vector: queryVector,
        },
        limit: 5,
        with_payload: true,
        filter: {
          must: [
            {
              key: "userId",
              match: { value: userId },
            },
          ],
        },
      });

      if (searchResult.length > 0) {
        contextText = searchResult
          .map((r) => (r.payload?.text as string) || "")
          .filter(Boolean)
          .join("\n\n");
      }
    } catch (err) {
      console.warn("[chat] RAG search failed, continuing without context:", err);
    }

    // Build final system prompt with context
    // const finalSystemPrompt = contextText
    //   ? `${systemPrompt}\n\nRelevant context from the knowledge base:\n${contextText}\n\nUse this context to answer accurately. If the answer is not in the context, say so.`
    //   : systemPrompt;
    console.log("🔍 RAG context length:", contextText.length);
    const finalSystemPrompt = contextText
      ? `
You are an AI assistant for this website.

STRICT RULES:
- Answer ONLY using the provided context below
- Do NOT use general knowledge
- If the answer is not in the context, say:
  "I don't know based on the provided data."

CONTEXT:
${contextText}
`
      : `
You are an AI assistant.

If no context is available, say:
"I don't have enough data yet. Please train me first."
`;

    // Call Groq
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
      max_tokens: 1024,
      temperature: 0.7,
    });

    const text = completion.choices[0]?.message?.content || "Sorry, I could not generate a response.";

    return NextResponse.json({ text }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[chat] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}