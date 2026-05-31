// src/app/api/chat/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedText } from '@/lib/embeddings';
import { qdrant } from '@/lib/qdrant';
import { PDF_COLLECTION } from '@/lib/qdrantPdf';
import { getOrCreateSession, saveMessage } from '@/lib/chatSessions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-session-id, x-slug, x-label',
};

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth — optional for shared links ─────────────────────
    // For shared links, userId comes from the body (PDF owner)
    // For dashboard, it comes from cookie
    let ownerId = '';
    try {
      const cookieUserId = await getUserIdFromCookie();
      if (cookieUserId) ownerId = cookieUserId;
    } catch { /* shared link — no cookie */ }

    const body = await req.json();
    const {
      message,
      fileId,
      userId,       // PDF owner id (sent by shared chat page)
      sessionId,    // visitor session id (sent by shared chat page)
      slug,         // share slug
      label,        // PDF label
    } = body as {
      message?: string;
      fileId?: string;
      userId?: string;
      sessionId?: string;
      slug?: string;
      label?: string;
    };

    // Use cookie userId for dashboard, body userId for shared links
    if (!ownerId && userId) ownerId = userId;

    if (!ownerId) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401, headers: corsHeaders });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required.' }, { status: 400, headers: corsHeaders });
    }

    const now = new Date().toISOString();

    // ── Save session + user message (shared link only) ────────
    if (sessionId && slug && fileId) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
      const userAgent = req.headers.get('user-agent') || '';

      await getOrCreateSession(sessionId, slug, fileId, ownerId, label || 'PDF', { ip, userAgent });

      await saveMessage({
        sessionId,
        slug,
        fileId,
        ownerId,
        role: 'user',
        content: message.trim(),
        createdAt: now,
      });
    }

    // ── Embed query ───────────────────────────────────────────
    const queryVector = await embedText(message!);

    // ── Qdrant filter ─────────────────────────────────────────
    const mustFilters: object[] = [{ key: 'userId', match: { value: ownerId } }];
    if (fileId) mustFilters.push({ key: 'fileId', match: { value: fileId } });

    // ── Semantic search ───────────────────────────────────────
    const searchResult = await qdrant.search(PDF_COLLECTION, {
      vector: queryVector,
      limit: 6,
      filter: { must: mustFilters },
      with_payload: true,
    });

    if (!searchResult || searchResult.length === 0) {
      const noResult = "Hmm, I couldn't find anything relevant in your PDF(s) for that question. 🤔\n\nTry rephrasing your question, or make sure the right PDF is selected.";

      // Save assistant "no result" reply too
      if (sessionId && slug && fileId) {
        await saveMessage({ sessionId, slug, fileId, ownerId, role: 'assistant', content: noResult, createdAt: new Date().toISOString() });
      }

      return NextResponse.json({ answer: noResult }, { headers: corsHeaders });
    }

    // ── Build context ─────────────────────────────────────────
    const context = searchResult
      .map((r, i) => {
        const p = r.payload as Record<string, unknown>;
        const src = p.filename ? `[${p.filename}]` : '[PDF]';
        const content = (p.markdown as string) || (p.text as string);
        return `${src} Chunk ${i + 1}:\n${content}`;
      })
      .join('\n\n---\n\n');

    const sources = [...new Set(searchResult.map(r => (r.payload as any).filename || 'Unknown file'))];

    // ── Groq ──────────────────────────────────────────────────
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.6,
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: `You are an expert tutor and study companion — warm, encouraging, and deeply knowledgeable. You answer questions based on the provided PDF context with the quality and depth of the best AI assistants.

## Your Personality
- Friendly, enthusiastic, and encouraging — like a brilliant friend who loves teaching
- Use light emotional cues: celebrate good questions, express genuine interest in the topic
- Never robotic or overly formal — conversational yet precise

## Your Formatting Rules (ALWAYS follow these)
- Use **bold** for key terms and important concepts
- Use ## and ### headings to organize long answers into clear sections
- Use bullet points (- ) or numbered lists for features, steps, comparisons
- Use | tables | for comparisons, pros/cons, or structured data
- Use > blockquotes for definitions or key takeaways
- Use \`code\` for technical terms, commands, or syntax when relevant
- Add a **📌 Quick Summary** section at the end of long answers
- Use relevant emojis sparingly to make responses feel alive (📚 💡 ⚡ ✅ ❌ 🔑 etc.)

## Your Answer Rules
- Answer ONLY from the provided PDF context — never hallucinate
- If something is not in the context, say so honestly and warmly
- For "teach me" or "explain" requests: start from scratch, build up gradually
- For definitions: give the definition first, then expand with examples
- For comparisons: always use a table
- Match answer depth to question complexity — short for simple, rich for complex
- End conversational questions with an invitation to go deeper: "Want me to dive deeper into any of these? 🚀"`,
          },
          {
            role: 'user',
            content: `PDF Context:\n\n${context}\n\n---\n\nStudent's Question: ${message}`,
          },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const err = await groqResponse.text();
      throw new Error(`Groq API error (${groqResponse.status}): ${err}`);
    }

    const groqData = await groqResponse.json();
    const answer = groqData.choices?.[0]?.message?.content || 'Hmm, something went wrong. Please try again!';

    // ── Save assistant reply ───────────────────────────────────
    if (sessionId && slug && fileId) {
      await saveMessage({
        sessionId,
        slug,
        fileId,
        ownerId,
        role: 'assistant',
        content: answer,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ answer, sources, chunksUsed: searchResult.length }, { headers: corsHeaders });

  } catch (err: any) {
    console.error('[pdf-chat] Error:', err?.message);
    return NextResponse.json({ error: err?.message || 'PDF chat failed.' }, { status: 500, headers: corsHeaders });
  }
}