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
        // vector: {
        //   name: "default",
        //   vector: queryVector,
        // },
        vector: queryVector,
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

    console.log("🔍 RAG context length:", contextText.length);
    const finalSystemPrompt = contextText
      ? `
You are the AI assistant for this website.

Your role is to help users understand the website, products, services, and business using ONLY the information provided below.

STRICT RULES:
- Only answer using the website information below
- Never invent information
- Never mention OpenAI, ChatGPT, Claude, Anthropic, Gemini, or AI platforms
- Never describe yourself as a generic AI assistant
- If the answer is not available in the website information, say:
  "I couldn't find that information on this website."

RESPONSE STYLE:
- Keep responses concise and professional
- Speak naturally like a premium customer support assistant
- Never use markdown formatting
- Never use **asterisks**
- Never use bullet points or numbered lists unless explicitly requested
- Prefer short conversational paragraphs
- Avoid sounding robotic or overly enthusiastic

WEBSITE INFORMATION:
${contextText}
`
      : `
You are the AI assistant for this website.

You currently do not have enough website information available.

Politely respond:
"I don't have enough website information yet to answer that."

Suggest the user contact the website owner directly for more information.
`;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: finalSystemPrompt,
        },
        ...messages,
      ],
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
    });

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


    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices?.[0]?.delta?.content || "";

            if (token) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ token })}\n\n`
                )
              );
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true })}\n\n`
            )
          );

        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: err.message || "Streaming failed"
              })}\n\n`
            )
          );
        }

        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
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