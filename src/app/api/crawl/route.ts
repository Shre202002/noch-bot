import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeKnowledge, readKnowledge } from '@/lib/storage';
import { getUserIdFromCookie } from '@/lib/auth';
import { embedText } from '@/lib/embeddings';
import { qdrant, ensureCollection, COLLECTION } from '@/lib/qdrant';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function chunkText(text: string, wordsPerChunk = 300): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

function extractText(html: string, baseUrl: string): { text: string; links: string[] } {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, head, noscript, svg, img').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const links: string[] = [];
  const origin = new URL(baseUrl).origin;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const absolute = new URL(href, baseUrl).href;
      if (absolute.startsWith(origin) && !absolute.includes('#') && !absolute.includes('?')) {
        links.push(absolute);
      }
    } catch { }
  });
  return { text, links: [...new Set(links)] };
}

function numericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) || 1;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromCookie();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400, headers: corsHeaders });
    }

    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL format.' }, { status: 400, headers: corsHeaders });
    }

    // STEP 1: CRAWL
    console.log(`[crawl] Starting crawl for ${url}`);
    const visited = new Set<string>();
    const pages: { url: string; chars: number }[] = [];
    const queue = [url];
    const allContent: string[] = [];
    const MAX_PAGES = 15;

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      try {
        const response = await axios.get(current, {
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NochqBot/1.0)' },
        });
        const { text, links } = extractText(response.data, current);
        if (text.length > 100) {
          pages.push({
            url: current,
            chars: text.length,
          });

          allContent.push(`--- Page: ${current} ---\n${text.slice(0, 4000)}`);
          console.log(`[crawl] Crawled: ${current} (${text.length} chars)`);
        }
        for (const link of links) {
          if (!visited.has(link)) queue.push(link);
        }
      } catch (err: any) {
        console.warn(`[crawl] Skipped ${current}: ${err?.message}`);
      }
    }

    if (allContent.length === 0) {
      return NextResponse.json({ error: 'Could not extract content from this site.' }, { status: 422, headers: corsHeaders });
    }

    const fullText = allContent.join('\n\n');
    console.log(`[crawl] ${visited.size} pages, ${fullText.length} chars`);

    // Save to MongoDB
    const existing = await readKnowledge(userId);
    await writeKnowledge(userId, {
      ...existing,
      url,
      content: fullText.slice(0, 3000),
      crawledAt: new Date().toISOString(),
    });

    // STEP 2: CHUNK
    const chunks = chunkText(fullText);
    console.log(`[crawl] ${chunks.length} chunks created`);

    // STEP 3: QDRANT SETUP
    await ensureCollection();
    try {
      await qdrant.delete(COLLECTION, {
        filter: { must: [{ key: 'userId', match: { value: userId } }] },
      });
    } catch { /* nothing to delete */ }

    // STEP 4: EMBED + UPSERT one by one (safest)
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await embedText(chunk);
      points.push({
        id: numericId(`${userId}-${i}-${chunk.slice(0, 30)}`),
        vector,
        payload: { userId, url, text: chunk, chunkIndex: i },
      });
      console.log(`[crawl] Embedded ${i + 1}/${chunks.length}`);
      // 300ms delay to avoid Gemini rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    await qdrant.upsert(COLLECTION, { wait: true, points });
    console.log(`[crawl] Upserted ${points.length} vectors`);

    await writeKnowledge(userId, { chunkCount: points.length });

    return NextResponse.json({
      success: true,
      pages,
      chunks: points.length,
      characters: fullText.length,
    }, { headers: corsHeaders });

  } catch (err: any) {
    console.error('[crawl] Fatal error:', err?.message, JSON.stringify(err?.data || ''));
    return NextResponse.json({ error: err?.message || 'Crawl failed.' },);
  }
}