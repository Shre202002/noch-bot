
import { NextRequest } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { writeKnowledge, readKnowledge } from "@/lib/storage";
import { getUserIdFromCookie } from "@/lib/auth";
import { embedText } from "@/lib/embeddings";
import { qdrant, ensureCollection, COLLECTION } from "@/lib/qdrant";
import { v4 as uuid } from "uuid";

function chunkText(text: string, wordsPerChunk = 500): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}

function extractText(html: string, baseUrl: string): { text: string; links: string[] } {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, head, noscript, svg, img").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const links: string[] = [];
  const origin = new URL(baseUrl).origin;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const absolute = new URL(href, baseUrl).href;
      if (
        absolute.startsWith(origin) &&
        !absolute.includes("#") &&
        !absolute.includes("?")
      ) {
        links.push(absolute);
      }
    } catch {}
  });
  return { text, links: [...new Set(links)] };
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        const body = await req.json();
        const { url, extraUrls = [] } = body;

        if (!url) {
          send({ type: "error", message: "URL is required." });
          controller.close();
          return;
        }

        try {
          new URL(url);
        } catch {
          send({ type: "error", message: "Invalid URL format." });
          controller.close();
          return;
        }

        const userId = await getUserIdFromCookie();
        if (!userId) {
          send({ type: "error", message: "Not authenticated." });
          controller.close();
          return;
        }

        const visited = new Set<string>();
        const queue = [url, ...extraUrls.filter(Boolean)];
        const allContent: string[] = [];
        const MAX_PAGES = 15;

        send({ type: "start", message: `Starting crawl for ${url}` });

        while (queue.length > 0 && visited.size < MAX_PAGES) {
          const current = queue.shift()!;
          if (visited.has(current)) continue;
          visited.add(current);

          send({
            type: "crawling",
            page: current,
            count: visited.size,
            total: Math.min(queue.length + visited.size, MAX_PAGES),
          });

          try {
            const response = await axios.get(current, {
              timeout: 8000,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ChatBot-Crawler/1.0)",
              },
            });

            const { text, links } = extractText(response.data, current);

            if (text.length > 100) {
              allContent.push(`\n\n--- Page: ${current} ---\n${text.slice(0, 3000)}`);
              send({ type: "page_done", page: current, chars: text.length });
            }

            for (const link of links) {
              if (!visited.has(link)) queue.push(link);
            }
          } catch {
            send({ type: "page_error", page: current });
          }
        }

        if (allContent.length === 0) {
          send({ type: "error", message: "Could not extract content from this site." });
          controller.close();
          return;
        }

        const fullText = allContent.join("\n");

        // Save to MongoDB fallback
        const existing = await readKnowledge(userId);
        await writeKnowledge(userId, {
          ...existing,
          url,
          content: fullText.slice(0, 3000),
          crawledAt: new Date().toISOString(),
        });

        // Chunk
        send({ type: "embedding", message: "Chunking content..." });
        const chunks = chunkText(fullText);
        send({ type: "embedding", message: `Created ${chunks.length} chunks. Starting embeddings...` });

        // Qdrant setup
        try {
          await ensureCollection();
          await qdrant.delete(COLLECTION, {
            filter: {
              must: [{ key: "userId", match: { value: userId } }],
            },
          });
        } catch (err: any) {
          send({ type: "embedding", message: `Qdrant setup warning: ${err?.message}` });
        }

        // Embed + upsert
        send({ type: "embedding", message: `Embedding ${chunks.length} chunks...` });
        try {
          const points = await Promise.all(
            chunks.map(async (chunk, i) => ({
              id: uuid(),
              vector: await embedText(chunk),
              payload: { userId, url, text: chunk, chunkIndex: i },
            }))
          );
          await qdrant.upsert(COLLECTION, { points });
          send({ type: "embedding", message: `✅ ${chunks.length} vectors stored!` });
        } catch (err: any) {
          send({ type: "embedding", message: `Vector storage failed: ${err?.message}. Using basic mode.` });
        }

        send({
          type: "done",
          pagesCrawled: visited.size,
          characters: fullText.length,
          chunks: chunks.length,
        });

      } catch (err: any) {
        send({ type: "error", message: err?.message || "Crawl failed." });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
