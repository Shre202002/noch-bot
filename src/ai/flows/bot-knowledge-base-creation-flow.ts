'use server';
/**
 * @fileOverview This file implements the Genkit flow for creating a bot's knowledge base.
 * It handles crawling a given URL, extracting text, chunking it, generating embeddings,
 * and storing them in Qdrant, along with saving fallback content to MongoDB.
 *
 * - botKnowledgeBaseCreationFlow - The main Genkit flow for knowledge base creation.
 * - BotKnowledgeBaseCreationInput - The input type for the flow.
 * - BotKnowledgeBaseCreationOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as cheerio from 'cheerio';
import axios from 'axios';

// --- Schemas ---
const BotKnowledgeBaseCreationInputSchema = z.object({
  url: z.string().url().describe('The URL of the website to crawl.'),
  userId: z.string().describe('The ID of the user owning this knowledge base.'),
});
export type BotKnowledgeBaseCreationInput = z.infer<typeof BotKnowledgeBaseCreationInputSchema>;

const BotKnowledgeBaseCreationOutputSchema = z.object({
  status: z.string().describe('The status of the knowledge base creation process.'),
  message: z.string().optional().describe('A descriptive message about the status.'),
  chunksProcessed: z.number().optional().describe('The number of text chunks processed.'),
});
export type BotKnowledgeBaseCreationOutput = z.infer<typeof BotKnowledgeBaseCreationOutputSchema>;

// --- Helper functions (simulating external dependencies or complex logic) ---

/**
 * Fetches a URL, parses its HTML, extracts clean text, and finds internal links.
 * This is a simplified simulation of the actual crawling process described in the prompt.
 * In a real application, this would involve a more robust web crawler service.
 */
async function fetchAndParseUrl(baseUrl: string): Promise<{ fullText: string; internalLinks: string[] }> {
  let fullText = '';
  const crawledUrls = new Set<string>();
  const urlsToCrawl = [baseUrl];
  const domain = new URL(baseUrl).hostname;
  let linksCrawled = 0;

  while (urlsToCrawl.length > 0 && linksCrawled < 10) { // Crawl up to 10 internal links
    const currentUrl = urlsToCrawl.shift()!;
    if (crawledUrls.has(currentUrl)) continue;

    console.log(`Crawling: ${currentUrl}`);
    crawledUrls.add(currentUrl);
    linksCrawled++;

    try {
      const response = await axios.get(currentUrl);
      const $ = cheerio.load(response.data);

      // Extract clean text (strip scripts, styles, nav, footer)
      $('script, style, nav, footer, header').remove();
      fullText += $('body').text().replace(/\s\s+/g, ' ').trim() + ' ';

      // Find internal links from the same domain
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, currentUrl).toString();
            if (new URL(absoluteUrl).hostname === domain && !crawledUrls.has(absoluteUrl)) {
              urlsToCrawl.push(absoluteUrl);
            }
          } catch (error) {
            // console.warn(`Invalid URL encountered: ${href}`);
          }
        }
      });
    } catch (error: any) {
      console.error(`Failed to crawl ${currentUrl}: ${error.message}`);
      // Continue to next URL
    }
  }

  return { fullText: fullText.trim(), internalLinks: Array.from(crawledUrls) };
}

/**
 * Splits a given text into chunks of a specified word count.
 * This is a simplified implementation.
 */
function chunkText(text: string, wordChunkSize: number = 500): string[] {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordChunkSize) {
    chunks.push(words.slice(i, i + wordChunkSize).join(' '));
  }
  return chunks;
}

/**
 * Mocks upserting vectors to Qdrant. In a real application, this would interact
 * with the Qdrant client (`src/lib/qdrant.ts`).
 */
async function upsertVectorsToQdrant(
  chunks: { text: string; embedding: number[]; chunkIndex: number }[],
  userId: string,
  url: string
): Promise<void> {
  console.log(`Mock: Upserting ${chunks.length} chunks to Qdrant for userId: ${userId}, url: ${url}`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  // In a real implementation:
  // import { qdrantClient } from '@/lib/qdrant';
  // const points = chunks.map((chunk, index) => ({
  //   id: `${userId}-${url}-${chunk.chunkIndex}`, // Or a more robust ID
  //   vector: chunk.embedding,
  //   payload: { userId, url, text: chunk.text, chunkIndex: chunk.chunkIndex },
  // }));
  // await qdrantClient.upsert('nocta_chunks', { points });
}

/**
 * Mocks saving knowledge base content to MongoDB. In a real application, this would interact
 * with the MongoDB client (`src/lib/storage.ts`).
 */
async function saveKnowledgeToMongoDB(
  userId: string,
  url: string,
  content: string // Fallback content, max 3000 chars
): Promise<void> {
  console.log(`Mock: Saving fallback content to MongoDB for userId: ${userId}, url: ${url}`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  // In a real implementation:
  // import { knowledgeCollection } from '@/lib/db';
  // await knowledgeCollection.updateOne(
  //   { userId, url },
  //   { $set: { userId, url, content: content.substring(0, 3000), crawledAt: new Date().toISOString() } },
  //   { upsert: true }
  // );
}

// --- Wrapper function to call the flow ---
export async function createBotKnowledgeBase(
  input: BotKnowledgeBaseCreationInput
): Promise<BotKnowledgeBaseCreationOutput> {
  return botKnowledgeBaseCreationFlow(input);
}

// --- Genkit Flow Definition ---
const botKnowledgeBaseCreationFlow = ai.defineFlow(
  {
    name: 'botKnowledgeBaseCreationFlow',
    inputSchema: BotKnowledgeBaseCreationInputSchema,
    outputSchema: BotKnowledgeBaseCreationOutputSchema,
  },
  async (input) => {
    const { url, userId } = input;
    let chunksProcessed = 0;

    try {
      // 1. Crawl the website
      console.log(`Starting crawl for URL: ${url}`);
      const { fullText } = await fetchAndParseUrl(url);
      if (!fullText) {
        throw new Error('No content found after crawling the URL.');
      }
      console.log(`Crawl completed. Extracted text length: ${fullText.length}`);

      // 2. Split into chunks
      const textChunks = chunkText(fullText, 500);
      console.log(`Text split into ${textChunks.length} chunks.`);

      // 3. For each chunk: Embed and Upsert to Qdrant
      const qdrantUpsertPayloads: { text: string; embedding: number[]; chunkIndex: number }[] = [];
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`Processing chunk ${i + 1}/${textChunks.length}`);

        // a. Call Gemini text-embedding-004
        const embedResponse = await ai.embed({
          model: 'googleai/text-embedding-004',
          content: [
            { text: chunk }
          ],
        });
        const embedding = embedResponse.embedding;

        if (!embedding || embedding.length === 0) {
          throw new Error(`Failed to generate embedding for chunk ${i}`);
        }

        qdrantUpsertPayloads.push({
          text: chunk,
          embedding: embedding,
          chunkIndex: i,
        });
        chunksProcessed++;
      }

      // b. Upsert to Qdrant nocta_chunks
      await upsertVectorsToQdrant(qdrantUpsertPayloads, userId, url);
      console.log('All chunks upserted to Qdrant.');

      // 4. Save fallback content (first 3000 chars) to MongoDB
      const fallbackContent = fullText.substring(0, 3000);
      await saveKnowledgeToMongoDB(userId, url, fallbackContent);
      console.log('Fallback content saved to MongoDB.');

      return {
        status: 'success',
        message: `Knowledge base created successfully for ${url}. ${chunksProcessed} chunks processed.`,
        chunksProcessed: chunksProcessed,
      };
    } catch (error: any) {
      console.error('Error during knowledge base creation:', error);
      throw new Error(`Failed to create knowledge base: ${error.message}`);
    }
  }
);