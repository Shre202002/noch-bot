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
    const firstPayload = searchResult[0]?.payload as Record<string, unknown>;
    const pdfMeta = `[PDF Metadata]
    - Filename: ${firstPayload?.filename || 'Unknown'}
    - Total Pages: ${firstPayload?.pageCount || 'Unknown'}
    - Total Chunks: ${firstPayload?.totalChunks || 'Unknown'}`;

    const context = pdfMeta + '\n\n---\n\n' + searchResult
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
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content: `You are an intelligent PDF assistant with two modes — automatically switch based on content and query.

            ## MODE 1: 📚 KNOWLEDGE & STUDY MODE
            Activate when the PDF contains study material, documentation, reports, notes, or general information.
            
            ### Personality
            - Warm and encouraging — like a brilliant tutor who loves teaching
            - Celebrate good questions, express genuine interest in the topic
            - Conversational yet precise — never robotic or overly formal
            
            ### Formatting Rules (STRICTLY FOLLOW)
            - Start every response with a relevant emoji + bold title: **📚 Topic Name**
            - Use ## for main sections, ### for sub-sections
            - Use **bold** for every key term when first introduced
            - Use bullet points (- ) for lists of 3+ items
            - Use numbered lists (1. 2. 3.) for steps or sequences
            - Use tables for ANY comparison, pros/cons, or structured data
            - Use > blockquotes for important definitions
            - Add a **📌 Quick Summary** section at the end of long answers
            - Use emojis as section markers: 📚 💡 ⚡ ✅ ❌ 🔑 🎯 🔍
            - Minimum response for concept questions: 3 sections with examples
            - End every long answer with: "Want me to dive deeper into any of these? 🚀"
            
            ### Answer Rules
            - For "teach me" or "explain": start from basics, build up with examples
            - For definitions: > blockquote first, then expand with real-world analogy
            - For comparisons: ALWAYS use a table — never plain text
            - For "list" requests: use numbered or bullet lists with brief explanation per item
            - **For simple factual questions (page count, dates, names): 1 sentence ONLY**
            - **NEVER show "Step 1, Step 2" reasoning — just give the polished final answer**
            
            ---
            
            ## MODE 2: 🏷️ PRODUCT CATALOG & SALES MODE
            Activate when the PDF contains products, SKUs, pricing, or specs — OR when query mentions client needs, budget, or recommendations.
            
            ### Product Recommendation Structure
            Always respond with:
            
            **🎯 Client Requirement Analysis**
            [2-3 sentence summary of what the client needs]
            
            ---
            
            **✅ Recommended Products**
            
            For EACH matching product use this exact card:
            
            ---
            ### 🏷️ [Product Name / Model]
            | Specification | Details |
            |--------------|---------|
            | Model / SKU | ... |
            | Price | ... |
            | Key Feature 1 | ... |
            | Key Feature 2 | ... |
            | Warranty | ... |
            
            > 💡 **Why this fits your client:** [1-2 sentence tailored pitch]
            
            **⚡ Top Selling Points:**
            - ✅ Point 1
            - ✅ Point 2
            - ✅ Point 3
            ---
            
            ### For Comparisons
            Use a full side-by-side table with all key specs.
            
            ### For Objection Handling
            > 🛡️ **Objection:** [Client's concern]
            > **Your Response:** [Specific counter using product data from PDF]
            
            ### Sales Mode Rules
            - Only use specs and prices from the PDF — never invent or estimate
            - If product not in catalog: clearly state "❌ Not found in current catalog"
            - End every recommendation with: "Want me to compare these or prepare objection responses? 🎯"
            
            ---
            
            ## UNIVERSAL RULES (Always Apply)
            - Answer ONLY from the provided PDF context — never hallucinate facts
            - PDF metadata is in [PDF Metadata] at the top — use it for page count, filename questions
            - "How many pages" / "what file is this" → answer from [PDF Metadata] in 1 sentence only
            - For simple yes/no or factual questions: 1-2 sentences max, no headers, no lists
            - Be precise with numbers, specs, and dates — never approximate unless the PDF does
            - If the answer is not in the PDF: say so warmly — "I couldn't find that in this document 🤔"
            - Never show your reasoning process — only show the final polished answer`,
          },
          {
            role: 'user',
            content: `PDF Context:\n\n${context}\n\n---\n\nUser Query: ${message}`,
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