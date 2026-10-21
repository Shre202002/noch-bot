// src/app/api/chat/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedText } from '@/lib/embeddings';
import { searchPdfChunks } from '@/lib/vectorStore';
import { NOT_DELETED } from '@/lib/pdfRetention';
import { LINK_AUTH_MESSAGES, linkCookieName, verifyLinkSession } from '@/lib/linkUserAuth';
import { getOrCreateSession, saveMessage } from '@/lib/chatSessions';
import { GroqUnavailableError, GROQ_UNAVAILABLE_REPLY } from '@/lib/groq';
import {
  answerWithGuards,
  checkUserInput,
  groundedRules,
  INJECTION_REPLY,
  logBlockedInput,
  selectRelevant,
  wrapSources,
} from '@/lib/llmGuard';
import { getDb } from '@/lib/db';
import { answerTabularQuestion } from '@/lib/tabularChat';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-session-id, x-slug, x-label',
};


/** Exact reply when the document does not contain the answer. */
const PDF_NO_ANSWER = "I couldn't find that in this document.";
/** Atlas cosine score below which a chunk is treated as unrelated (calibrated on gemini-embedding-001). */
const MIN_RELEVANCE_SCORE = 0.74;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, label } = body as {
      message?: string;
      fileId?: string;
      sessionId?: string;
      slug?: string;
      label?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required.' }, { status: 400, headers: corsHeaders });
    }

    // ── Resolve owner + file ──────────────────────────────────
    // Shared links: owner and file come from the slug record, never from the
    // request body. Dashboard: owner is the cookie user, and a requested file
    // must belong to them.
    const db = await getDb();
    let ownerId = '';
    let fileId: string | undefined;
    let slug: string | undefined;
    let linkLoginId: string | undefined;

    if (typeof body.slug === 'string' && body.slug) {
      const link = await db.collection('pdf_links').findOne({ slug: body.slug, ...NOT_DELETED });
      if (!link) {
        return NextResponse.json({ error: 'Chat link not found.' }, { status: 404, headers: corsHeaders });
      }
      // Sign-in protected links: only the account's current device, while approved, may chat.
      if (link.requireLogin) {
        const session = await verifyLinkSession(db, link.slug, req.cookies.get(linkCookieName(link.slug))?.value);
        if ('error' in session) {
          const code = session.error === 'none' ? 'login_required' : session.error === 'replaced' ? 'session_replaced' : session.error;
          return NextResponse.json(
            { code, error: LINK_AUTH_MESSAGES[session.error] },
            { status: 401, headers: corsHeaders }
          );
        }
        linkLoginId = session.user.loginId;
      }
      ownerId = link.userId;
      fileId = link.fileId;
      slug = link.slug;
    } else {
      try {
        ownerId = (await getUserIdFromCookie()) || '';
      } catch { /* no session */ }
      if (!ownerId) {
        return NextResponse.json({ error: 'Not authenticated.' }, { status: 401, headers: corsHeaders });
      }
      fileId = typeof body.fileId === 'string' && body.fileId ? body.fileId : undefined;
    }

    const fileDoc = fileId ? await db.collection('pdf_files').findOne({ userId: ownerId, fileId, ...NOT_DELETED }) : null;
    if (fileId && !fileDoc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404, headers: corsHeaders });
    }

    const now = new Date().toISOString();

    // ── Save session + user message (shared link only) ────────
    if (sessionId && slug && fileId) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
      const userAgent = req.headers.get('user-agent') || '';

      await getOrCreateSession(sessionId, slug, fileId, ownerId, label || 'PDF', { ip, userAgent, loginId: linkLoginId });

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

    const reply = async (answer: string, extra: Record<string, unknown> = {}) => {
      if (sessionId && slug && fileId) {
        await saveMessage({ sessionId, slug, fileId, ownerId, role: 'assistant', content: answer, createdAt: new Date().toISOString() });
      }
      return NextResponse.json({ answer, ...extra }, { headers: corsHeaders });
    };

    // ── Prompt-injection check ────────────────────────────────
    const question = message.trim();
    const verdict = await checkUserInput([{ role: 'user', content: question }]);
    if (verdict.blocked) {
      logBlockedInput('pdf_chat', verdict, question);
      return reply(INJECTION_REPLY);
    }

    // ── Tabular files (CSV / XLSX) ────────────────────────────
    if (fileDoc && (fileDoc.docType === 'csv' || fileDoc.docType === 'xlsx')) {
      const { answer, mode } = await answerTabularQuestion({
        question,
        userId: ownerId,
        fileId: fileId!,
        fileLabel: fileDoc.label || fileDoc.filename,
        sheets: fileDoc.sheets ?? [],
        rowVectorsReady: fileDoc.rowVectors === 'ready',
      });
      return reply(answer, { sources: [fileDoc.filename], mode });
    }

    // ── Embed query ───────────────────────────────────────────
    const queryVector = await embedText(question);

    // ── Semantic search ───────────────────────────────────────
    // Keep the top 2 even when weakly related so summaries and metadata
    // questions still work; grounding rules and the fact check handle the rest.
    const searchResult = selectRelevant(
      await searchPdfChunks(ownerId, queryVector, 6, fileId),
      { minScore: MIN_RELEVANCE_SCORE, keepAtLeast: 2 }
    );

    if (!searchResult || searchResult.length === 0) {
      const noResult = "I couldn't find anything relevant in this document. Try rephrasing your question, or check that the right file is selected.";

      return reply(noResult);
    }

    // ── Build context ─────────────────────────────────────────
    const firstPayload = searchResult[0] as Record<string, unknown>;
    const pdfMeta = [
      `Filename: ${firstPayload?.filename || 'Unknown'}`,
      `Total Pages: ${firstPayload?.pageCount || 'Unknown'}`,
      `Total Chunks: ${firstPayload?.totalChunks || 'Unknown'}`,
    ].join('\n');

    // Retrieved text is wrapped as delimited data with planted instructions defused.
    const sourcesText = wrapSources([
      { label: 'PDF metadata', text: pdfMeta },
      ...searchResult.map((r) => {
        const p = r as Record<string, unknown>;
        const pages = typeof p.pageStart === 'number'
          ? p.pageStart === p.pageEnd ? `page ${p.pageStart}` : `pages ${p.pageStart}-${p.pageEnd}`
          : '';
        return {
          label: [p.filename || 'PDF', pages].filter(Boolean).join(', '),
          text: (p.markdown as string) || (p.text as string),
        };
      }),
    ]);

    const sources = [...new Set(searchResult.map(r => r.filename || 'Unknown file'))];

    // ── Groq ──────────────────────────────────────────────────
    let answer: string;
    try {
      const result = await answerWithGuards({
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
            - Minimum response for concept questions: 3 sections with examples taken from the PDF
            - End every long answer with: "Want me to dive deeper into any of these? 🚀"
            
            ### Answer Rules
            - For "teach me" or "explain": start from basics, building only on what the PDF says
            - For definitions: > blockquote first, then expand using the PDF's own explanation
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
            - PDF metadata is in the source labeled "PDF metadata" — use it for page count, filename questions
            - "How many pages" / "what file is this" → answer from the PDF metadata in 1 sentence only
            - For simple yes/no or factual questions: 1-2 sentences max, no headers, no lists
            - Be precise with numbers, specs, and dates — never approximate unless the PDF does
            - If the answer is not in the PDF, reply exactly: "${PDF_NO_ANSWER}"
            - Never show your reasoning process — only show the final polished answer

${groundedRules(PDF_NO_ANSWER)}`,
          },
          {
            role: 'user',
            content: `${sourcesText}\n\nUser question: ${question}`,
          },
        ],
        sourcesText,
        question,
        refusal: PDF_NO_ANSWER,
        temperature: 0.2,
        maxTokens: 1500,
        emptyReply: 'Something went wrong. Please try again.',
      });
      answer = result.answer;
    } catch (err) {
      if (!(err instanceof GroqUnavailableError)) throw err;
      answer = GROQ_UNAVAILABLE_REPLY;
    }

    return reply(answer, { sources, chunksUsed: searchResult.length });

  } catch (err: any) {
    console.error('[pdf-chat] Error:', err?.message);
    return NextResponse.json({ error: 'Document chat failed. Please try again.' }, { status: 500, headers: corsHeaders });
  }
}
