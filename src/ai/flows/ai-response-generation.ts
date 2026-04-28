'use server';
/**
 * @fileOverview A Genkit flow that handles AI response generation for the Nocta chatbot.
 * It embeds user questions, performs RAG using Qdrant, and streams responses from an LLM.
 *
 * - generateAiResponse - A function that handles the AI response generation process, returning a stream of text chunks.
 * - GenerateAiResponseInput - The input type for the generateAiResponse function.
 * - GenerateAiResponseOutput - The return type for the complete aggregated AI-generated response text (used for type inference and logging purposes, not directly returned as a whole by the streaming function).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// Assuming these are implemented and exported from their respective lib files.
import { embedContent } from '@/lib/embeddings';
import { qdrantClient, QDRANT_COLLECTION_NAME } from '@/lib/qdrant';

const QDRANT_TOP_K = 5; // Top 5 results from Qdrant.

const GenerateAiResponseInputSchema = z.object({
  question: z.string().describe('The user\'s question to the chatbot.'),
  userId: z.string().describe('The ID of the user, used for filtering Qdrant results.'),
  systemPrompt: z.string().optional().describe('An optional custom system prompt for the LLM.'),
  knowledgeContentFallback: z.string().optional().describe('Fallback content from MongoDB if Qdrant search yields no results or fails.'),
});
export type GenerateAiResponseInput = z.infer<typeof GenerateAiResponseInputSchema>;

// This schema represents the *full aggregated* response text, even though the function streams.
// It's primarily for Genkit's internal type inference and potential logging of the final result.
const GenerateAiResponseOutputSchema = z.string().describe('The full AI-generated response.');
export type GenerateAiResponseOutput = z.infer<typeof GenerateAiResponseOutputSchema>;

// Default system prompt if none is provided by the user.
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant for the Nocta chatbot.
Your goal is to provide concise, accurate, and relevant answers based ONLY on the provided context.
If the information is not available in the context, politely state that you don't have enough information.
Avoid making up answers. Do not mention that you are using context.`;

/**
 * Generates an AI response for a given user question, leveraging RAG from a Qdrant knowledge base.
 * The response is streamed in real-time.
 * @param input - The input containing the user's question, user ID, and optional system prompt/fallback content.
 * @returns An AsyncIterable of strings representing the streamed AI response.
 */
export async function generateAiResponse(
  input: GenerateAiResponseInput
): Promise<AsyncIterable<string>> {
  const { stream } = await aiResponseGenerationFlow(input);
  return stream;
}

// Define a prompt for the RAG process. The actual system prompt will be set dynamically.
const ragPrompt = ai.definePrompt({
  name: 'ragPrompt',
  input: {
    schema: z.object({
      context: z.string().describe('Relevant context extracted from the knowledge base.'),
      question: z.string().describe('The user\'s question.'),
    }),
  },
  // The output schema for the prompt reflects the expected text output.
  output: {
    schema: GenerateAiResponseOutputSchema,
  },
  // The 'system' field is intentionally omitted here as it will be passed dynamically
  // via `config.system` in `ai.generateStream` to allow custom system prompts.
  prompt: `Using the following context, answer the user's question.
If the answer is not found in the context, respond with "I apologize, but I don't have enough information to answer that question based on the provided knowledge base."

Context:
\`\`\`
{{{context}}}
\`\`\`

Question:
{{{question}}}`,
});

/**
 * The Genkit flow that orchestrates the AI response generation process.
 * It embeds the user question, searches Qdrant for context, and calls an LLM to generate a streamed response.
 */
const aiResponseGenerationFlow = ai.defineFlow(
  {
    name: 'aiResponseGenerationFlow',
    inputSchema: GenerateAiResponseInputSchema,
    // The output schema for the flow itself, returning both the stream and the full aggregated response.
    // This allows the flow to complete and log the full response while the caller gets the stream.
    // Note: z.any() is used for the stream as Zod does not have a direct type for AsyncIterable.
    outputSchema: z.object({
      stream: z.any(),
      fullResponse: GenerateAiResponseOutputSchema,
    }),
  },
  async (input) => {
    let contextString = '';

    try {
      // 1. Embed the user's question using Gemini text-embedding-004
      const questionEmbedding = await embedContent(input.question);

      // 2. Search Qdrant for relevant chunks, filtered by userId
      const searchResult = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
        vector: questionEmbedding,
        limit: QDRANT_TOP_K,
        filter: {
          must: [
            {
              key: 'userId',
              match: {
                value: input.userId,
              },
            },
          ],
        },
      });

      if (searchResult && searchResult.length > 0) {
        // Extract 'text' from payload and join to form context
        contextString = searchResult
          .map((hit) => (hit.payload as { text: string }).text)
          .join('\n\n');
      } else if (input.knowledgeContentFallback) {
        // 3. If Qdrant search fails or returns no results, use fallback from MongoDB
        contextString = input.knowledgeContentFallback;
      }
    } catch (error) {
      console.error('Error during RAG process (embedding or Qdrant search):', error);
      // Fallback if RAG pipeline has an error
      if (input.knowledgeContentFallback) {
        contextString = input.knowledgeContentFallback;
      } else {
        // If no fallback, provide a default minimal context to avoid errors
        contextString = 'No specific knowledge base context could be retrieved.';
      }
    }

    // Use the custom system prompt if provided, otherwise use the default.
    const effectiveSystemPrompt = input.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // 4. Call the LLM with the constructed context and user question.
    // IMPORTANT: The app proposal specifies Groq LLaMA 3.3 70B.
    // However, the provided genkit.ts only initializes with googleAI plugin.
    // Therefore, using googleai/gemini-1.5-flash which is a fast, capable model.
    // To use Groq, a 'groq' plugin would need to be added to genkit.ts.
    const { stream, response } = await ai.generateStream({
      model: ai.model('googleai/gemini-1.5-flash'),
      prompt: ragPrompt,
      input: {
        context: contextString,
        question: input.question,
      },
      config: {
        system: effectiveSystemPrompt,
      },
    });

    // Await the full response to ensure the flow formally completes
    // and to allow logging/tracing the full aggregated output.
    const fullResponseText = await response.text();

    return { stream, fullResponse: fullResponseText };
  }
);