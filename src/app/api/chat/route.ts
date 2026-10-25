import { NextRequest, NextResponse, after } from "next/server";
import { getDb } from "@/lib/db";
import { formatEventsSource, loadUpcomingEvents } from "@/lib/eventsForChat";
import { isBookingIntent } from "@/lib/bookingIntent";
import { findAccountById } from "@/lib/storage";
import { needsEmailVerification } from "@/lib/emailVerification";
import { embedText } from "@/lib/embeddings";
import { searchKnowledgeChunks } from "@/lib/vectorStore";
import { siteNameFrom } from "@/lib/widgetGreeting";
import {
  createOrFindConversation,
  saveMessage,
  updateConversationStats,
} from "@/lib/conversations";
import { checkMessageLimit } from "@/lib/ratelimit";
import { resolvePlanKey } from "@/lib/plans";
import { GroqUnavailableError, GROQ_UNAVAILABLE_REPLY } from "@/lib/groq";
import {
  answerWithGuards,
  checkUserInput,
  groundedRules,
  INJECTION_REPLY,
  logBlockedInput,
  sanitizeHistory,
  selectRelevant,
  wrapSources,
} from "@/lib/llmGuard";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};


/** Atlas cosine score below which a website chunk is treated as unrelated (calibrated on gemini-embedding-001). */
const MIN_RELEVANCE_SCORE = 0.74;

/**
 * Partially answerable questions ("how many flats do you have?" when pages list the flat types but no total) get the
 * related facts instead of a bare refusal. The widget and chat pages render only paragraphs, "- " lists and **bold**
 * (public/embed.js renderRich, src/components/ChatText.tsx), so the reply is limited to those.
 */
const ANSWER_STYLE_PROMPT = `When the sources do not state the exact detail asked for (for example a total count or a figure) but do contain closely related information, say that this detail is not listed on the website, then give the related facts from the sources (for example the types, options or locations available). Use the exact "not available" reply only when the sources contain nothing related to the question.
Format the reply for a small chat bubble:
- Start with one short sentence that answers directly.
- Put three or more items, options or steps on separate lines starting with "- ", one item per line, and put a blank line before and after the list.
- Begin each list item with its name in **double asterisks** followed by a colon, for example "- **Tower A**: 2 BHK, 880 sq ft".
- Keep paragraphs to one or two sentences, separated by a blank line.
- Use no headings, tables, links in brackets or other Markdown.`;

/**
 * "Connect me to the owner", "your number?", "I want to talk to someone": the visitor wants a person, and the useful
 * answer is the site's contact details, which a plain similarity search does not always rank in the top results.
 */
const CONTACT_INTENT = /\b(contact|call|phone|mobile|number|e-?mail|mail|whats\s?app|reach|talk|speak|connect|owner|manager|sales|team|someone|person|human|agent|address|location|located|visit|office|enquir|inquir)/i;
const CONTACT_QUERY = "Contact us: phone number, email address, office address and visiting hours";
let contactQueryVector: Promise<number[]> | null = null;

const CONTACT_PROMPT = `When the visitor asks to contact, call, email, visit, or be connected to the owner, the team, sales or any person at the organization, give the phone numbers, email address, address and visiting hours that appear in the sources and say they can reach the team there. You cannot connect them or pass on messages yourself. Do not refuse just because no source names an "owner". Copy every phone number and email address exactly as the sources write it, digit for digit, even if it looks unusual.`;

/**
 * Who the bot is, so "what is your name?" or "are you ChatGPT?" is answered with the site's own assistant name (the
 * one in the widget header) instead of the no-sources refusal. The underlying model and provider stay private.
 */
function identityPrompt(assistantName: string, siteName: string): string {
  return `You are ${assistantName}, the AI assistant on the ${siteName} website.
Questions about yourself (your name, who you are, what you can do, whether you are ChatGPT, Groq, Gemini, a bot or a person, which AI model you run on) need no sources: say you are ${assistantName}, an AI assistant that answers questions about ${siteName}, and offer to help with topics that appear in the sources. Do not name or confirm any AI model or AI company, and never claim to be human.`;
}

function refusalFor(siteName: string): string {
  return siteName === "this website"
    ? "I couldn't find that on this website. Please reach out to the website's team for help."
    : `I couldn't find that on the ${siteName} website. Please reach out to the ${siteName} team for help.`;
}

/** The assistant's name and site name for this account; falls back to generic wording so chat never fails here. */
async function loadIdentity(userId: string): Promise<{ assistantName: string; siteName: string }> {
  let siteName = "this website";
  let botName: string | undefined;
  try {
    const record = await (await getDb()).collection("knowledge").findOne(
      { userId },
      { projection: { botName: 1, widgetSiteName: 1, url: 1 } }
    );
    siteName = record?.widgetSiteName || siteNameFrom(null, record?.url);
    botName = typeof record?.botName === "string" && record.botName.trim() ? record.botName.trim() : undefined;
  } catch (err) {
    console.warn("[chat_api] identity lookup failed:", (err as Error)?.message);
  }
  const assistantName = botName ?? (siteName === "this website" ? "the assistant for this website" : `${siteName} Assistant`);
  return { assistantName, siteName };
}

/** Added to the system prompt when the organizer has upcoming events (see src/lib/eventsForChat.ts). */
const EVENTS_PROMPT = `
When the visitor shows interest in an event listed in the sources, give its date, price and availability from the sources and offer to book tickets in this chat (they can say "book tickets").`;

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

    // Only user/assistant turns, bounded in count and length; client-sent
    // system turns and chat-template tokens are dropped.
    const history = sanitizeHistory(messages);
    if (!history) {
      return NextResponse.json({ error: "A user message is required." }, { status: 400, headers: corsHeaders });
    }
    const userMessage = history[history.length - 1].content;

    const website = sourceUrl ? (() => { try { return new URL(sourceUrl).hostname; } catch { return "unknown"; } })() : "unknown";
    const effectiveSessionId = sessionId || `auto_${userId}_${Date.now()}`;

    // Rate Limit Check
    const account = await findAccountById(userId);
    // Visitors get the same reply as for a deactivated owner and are never told why.
    if (account?.disabled || needsEmailVerification(account)) {
      return NextResponse.json({ error: "This assistant is currently unavailable." }, { status: 403, headers: corsHeaders });
    }
    const plan = await resolvePlanKey(account);
    const rateCheck = await checkMessageLimit(userId, plan);

    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Limit reached", rateLimited: true }, { status: 429, headers: corsHeaders });
    }

    let text: string;
    let action = null;

    // Prompt-injection check: a blocked message never reaches the answering model.
    // The guard, retrieval, events and identity lookups are independent, so they run together;
    // a blocked message just discards the retrieval work.
    const verdictP = checkUserInput(history);

    // Knowledge Search (RAG). Weakly related chunks are dropped so the model
    // has nothing to improvise from on off-topic questions.
    const sourcesP = (async () => {
      const found: Array<{ label?: string; text: string }> = [];
      try {
        const queryVector = await embedText(userMessage);
        const searchResult = await searchKnowledgeChunks(userId, queryVector, 5);
        for (const r of selectRelevant(searchResult, { minScore: MIN_RELEVANCE_SCORE })) {
          if (r.text) found.push({ label: r.title || r.url, text: r.text });
        }

        // Contact requests also get the site's contact details, found with a fixed query whose vector is cached.
        if (CONTACT_INTENT.test(userMessage)) {
          contactQueryVector ??= embedText(CONTACT_QUERY).catch((err) => {
            contactQueryVector = null;
            throw err;
          });
          const contactResults = await searchKnowledgeChunks(userId, await contactQueryVector, 2);
          for (const r of contactResults) {
            if (r.text && !found.some((s) => s.text === r.text)) found.push({ label: r.title || r.url, text: r.text });
          }
        }
      } catch (err) {
        console.warn("[chat_api] knowledge search failed:", (err as Error)?.message);
      }
      return found;
    })();

    // The organizer's upcoming events, so questions about dates, prices and seats are answered from real data.
    const eventsP = getDb()
      .then((db) => loadUpcomingEvents(db, userId))
      .catch((err) => {
        console.warn("[chat_api] events lookup failed:", (err as Error)?.message);
        return [];
      });
    const identityP = loadIdentity(userId);

    const verdict = await verdictP;
    if (verdict.blocked) {
      // Settle the speculative lookups so a rejection is never left unhandled.
      void Promise.allSettled([sourcesP, eventsP, identityP]);
      logBlockedInput("website_chat", verdict, userMessage);
      text = INJECTION_REPLY;
    } else {
      // Intent Detection for Booking
      // Questions that only mention tickets ("is the price refundable?") are answered, not turned into a booking.
      if (isBookingIntent(userMessage)) {
        action = { type: "START_BOOKING" };
      }

      const sources = await sourcesP;
      const events = await eventsP;
      const hasEvents = events.length > 0;
      if (hasEvents) sources.push({ label: "Upcoming events", text: formatEventsSource(events) });

      const sourcesText = wrapSources(sources);
      const { assistantName, siteName } = await identityP;
      const refusal = refusalFor(siteName);
      try {
        const result = await answerWithGuards({
          messages: [
            {
              role: "system",
              content: `${identityPrompt(assistantName, siteName)}
Answer visitors' questions clearly and concisely in a professional tone.
If the visitor wants to book, buy tickets, or register for an event, say you can help them book; the booking flow starts separately, so this needs no sources.
Do not mention internal IDs or technical details.
${ANSWER_STYLE_PROMPT}
${CONTACT_PROMPT}${hasEvents ? EVENTS_PROMPT : ""}

${groundedRules(refusal)}`,
            },
            ...history.slice(0, -1),
            { role: "user", content: `${sourcesText}\n\nVisitor question: ${userMessage}` },
          ],
          sourcesText,
          question: userMessage,
          refusal,
          temperature: 0.1,
          emptyReply: "I'm sorry, I couldn't process that.",
        });
        text = result.answer;
      } catch (err) {
        if (!(err instanceof GroqUnavailableError)) throw err;
        text = GROQ_UNAVAILABLE_REPLY;
      }
    }

    // Persist after the response is sent so the visitor doesn't wait on four DB round trips.
    const responseTimeMs = Date.now() - startTime;
    const replyText = text;
    after(async () => {
      try {
        const conversationId = await createOrFindConversation(userId, effectiveSessionId, visitorId, website);
        await saveMessage({ userId, conversationId, sessionId: effectiveSessionId, role: "user", content: userMessage });
        await saveMessage({ userId, conversationId, sessionId: effectiveSessionId, role: "assistant", content: replyText, responseTimeMs });
        await updateConversationStats(conversationId);
      } catch (err) {
        console.error("[chat_api] save failed:", err);
      }
    });

    return NextResponse.json({ text, action, usage: rateCheck }, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[chat_api] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: corsHeaders });
  }
}
