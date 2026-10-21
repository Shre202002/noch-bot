import type { Db } from 'mongodb';
import { groqChat } from './groq';
import { KNOWLEDGE_VECTOR_COLLECTION } from './vectorStore';

/**
 * The website widget's first message, tailored to the crawled site ("Hi! Welcome to Kalamic. I can help with our
 * handmade ceramics, orders and shipping."). Written once by the model from the crawled page titles and opening text,
 * then cached on the knowledge record until the site is crawled again. Without crawl data, or if the model is
 * unavailable, a plain greeting with the site's name is used.
 */

const MAX_GREETING_CHARS = 220;
const MAX_TITLES = 8;
const SNIPPET_CHARS = 700;
const TITLE_SEPARATORS = /\s+[|\-–—:·•]\s+/;

const GREETING_PROMPT = `You write the first message of a website's chat assistant.
Write at most two short sentences: greet the visitor, name the site, and say what you can help with.
Use only the site name, page titles and text provided. Do not invent offers, prices, hours or facts.
Professional and warm. No emoji, no quotation marks, no markdown. Reply with the message only.`;

/** "Kalamic | Handmade Ceramics" → "Kalamic"; falls back to the domain ("www.kalamic.shop" → "Kalamic"). */
export function siteNameFrom(title: string | null | undefined, url: string | null | undefined): string {
  const fromTitle = (title ?? '').split(TITLE_SEPARATORS)[0]?.replace(/\s+/g, ' ').trim();
  if (fromTitle && fromTitle.length >= 2 && fromTitle.length <= 40 && !/^(home|homepage|index|welcome)$/i.test(fromTitle)) {
    return fromTitle;
  }
  try {
    const host = new URL(url ?? '').hostname.replace(/^www\./, '');
    const label = host.split('.')[0];
    if (label) return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    /* no usable URL */
  }
  return 'this website';
}

export function fallbackGreeting(siteName: string): string {
  return siteName === 'this website'
    ? "Hi! I'm the assistant for this website. How can I help you today?"
    : `Hi! I'm the ${siteName} assistant. How can I help you today?`;
}

/** Messages for the one-off greeting call. */
export function greetingMessages(siteName: string, titles: string[], snippet: string) {
  const sources = [
    `Site name: ${siteName}`,
    titles.length ? `Page titles:\n- ${titles.join('\n- ')}` : '',
    snippet ? `Opening text of the site:\n${snippet}` : '',
  ].filter(Boolean).join('\n\n');
  return [
    { role: 'system' as const, content: GREETING_PROMPT },
    { role: 'user' as const, content: sources },
  ];
}

/** Keep a model reply only if it is a short plain greeting; otherwise null (use the fallback). */
export function cleanGreeting(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[*_`#>]/g, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 10 || cleaned.length > MAX_GREETING_CHARS) return null;
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

type Generate = (messages: ReturnType<typeof greetingMessages>) => Promise<string | null>;

const defaultGenerate: Generate = async (messages) => {
  const completion = await groqChat({ messages, temperature: 0.3, max_tokens: 90 });
  return completion.choices[0]?.message?.content ?? null;
};

/** Greeting for the widget, generated at most once per crawl of the site. */
export async function getWidgetGreeting(
  db: Db,
  userId: string,
  deps: { generate?: Generate } = {}
): Promise<{ greeting: string; siteName: string }> {
  const knowledge = db.collection('knowledge');
  const record = await knowledge.findOne(
    { userId },
    { projection: { url: 1, activeGenerationId: 1, widgetGreeting: 1, widgetGreetingFor: 1, widgetSiteName: 1 } }
  );
  const crawlKey = record?.activeGenerationId ?? record?.url ?? null;

  if (record?.widgetGreeting && crawlKey && record.widgetGreetingFor === crawlKey) {
    return { greeting: record.widgetGreeting, siteName: record.widgetSiteName ?? siteNameFrom(null, record.url) };
  }

  // The crawled pages of the live crawl (older crawls have untagged chunks).
  const chunkFilter = record?.activeGenerationId
    ? { userId, generationId: record.activeGenerationId }
    : { userId, generationId: { $exists: false } };
  const chunks = await db
    .collection(KNOWLEDGE_VECTOR_COLLECTION)
    .find(chunkFilter, { projection: { _id: 0, title: 1, url: 1, text: 1, chunkIndex: 1 } })
    .limit(40)
    .toArray();

  const homepage = chunks.find((c) => {
    try { return new URL(c.url).pathname.replace(/\/+$/, '') === ''; } catch { return false; }
  }) ?? chunks[0];
  const siteName = siteNameFrom(homepage?.title, record?.url ?? homepage?.url);

  if (!crawlKey || chunks.length === 0) {
    return { greeting: fallbackGreeting(siteName), siteName };
  }

  const titles = Array.from(new Set(chunks.map((c) => String(c.title ?? '').trim()).filter(Boolean))).slice(0, MAX_TITLES);
  const snippet = String(homepage?.text ?? '').slice(0, SNIPPET_CHARS);

  let greeting: string | null = null;
  try {
    greeting = cleanGreeting(await (deps.generate ?? defaultGenerate)(greetingMessages(siteName, titles, snippet)));
  } catch (err) {
    console.warn('[widget-greeting] generation failed, using fallback:', (err as Error)?.message);
  }
  if (!greeting) return { greeting: fallbackGreeting(siteName), siteName };

  await knowledge.updateOne(
    { userId },
    { $set: { widgetGreeting: greeting, widgetGreetingFor: crawlKey, widgetSiteName: siteName } }
  );
  return { greeting, siteName };
}
