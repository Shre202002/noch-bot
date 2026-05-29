// src/app/api/chat/pdf/route.ts
// POST { message: string, fileId?: string }
// Searches nochbot_pdf_chunks → retrieves top-k → answers via Groq
// fileId is optional — omit to search across ALL user's PDFs

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedText } from '@/lib/embeddings';
import { qdrant } from '@/lib/qdrant';
import { PDF_COLLECTION } from '@/lib/qdrantPdf';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // fast + large context

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { message, fileId } = body as { message?: string; fileId?: string };

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'message is required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── 1. Embed the user query ───────────────────────────────
    const queryVector = await embedText(message);

    // ── 2. Build Qdrant filter ────────────────────────────────
    // Always scope to this user; optionally narrow to a single file
    const mustFilters: object[] = [{ key: 'userId', match: { value: userId } }];
    if (fileId) {
      mustFilters.push({ key: 'fileId', match: { value: fileId } });
    }

    // ── 3. Semantic search ────────────────────────────────────
    const searchResult = await qdrant.search(PDF_COLLECTION, {
      vector: queryVector,
      limit: 6,
      filter: { must: mustFilters },
      with_payload: true,
    });

    if (!searchResult || searchResult.length === 0) {
      return NextResponse.json(
        {
          answer:
            "I couldn't find relevant information in your uploaded PDF(s). Try uploading a PDF first or rephrasing your question.",
        },
        { headers: corsHeaders }
      );
    }

    // ── 4. Build context from retrieved chunks ────────────────
    const context = searchResult
      .map((r, i) => {
        const p = r.payload as Record<string, unknown>;
        const src = p.filename ? `[${p.filename}]` : '[PDF]';
        return `${src} Chunk ${i + 1}:\n${p.text}`;
      })
      .join('\n\n---\n\n');

    const sources = [
      ...new Set(
        searchResult.map((r) => {
          const p = r.payload as Record<string, unknown>;
          return (p.filename as string) || 'Unknown file';
        })
      ),
    ];

    // ── 5. Call Groq ──────────────────────────────────────────
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that answers questions based strictly on the provided PDF document context.
Only use information from the context below. If the answer is not in the context, say so clearly.
Do not make up information. Be concise and accurate.`,
          },
          {
            role: 'user',
            content: `Context from PDF(s):\n\n${context}\n\n---\n\nQuestion: ${message}`,
          },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      throw new Error(`Groq API error (${groqResponse.status}): ${err}`);
    }

    const groqData = await groqResponse.json();
    const answer = groqData.choices?.[0]?.message?.content || 'No response generated.';

    return NextResponse.json(
      {
        answer,
        sources,
        chunksUsed: searchResult.length,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[pdf-chat] Error:', err?.message);
    return NextResponse.json(
      { error: err?.message || 'PDF chat failed.' },
      { status: 500, headers: corsHeaders }
    );
  }
}