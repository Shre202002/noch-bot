'use server';
/**
 * @fileOverview A Genkit flow that handles AI response generation for the Nocta chatbot.
 * It embeds user questions, performs RAG using MongoDB Atlas Vector Search, and streams responses from an LLM.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { embedContent } from '@/lib/embeddings';
import { searchKnowledgeChunks } from '@/lib/vectorStore';

const VECTOR_TOP_K = 5;

const GenerateAiResponseInputSchema = z.object({
  question: z.string().describe("The user's question to the chatbot."),
  userId: z.string().describe('The ID of the user, used for filtering vector search results.'),
  systemPrompt: z.string().optional().describe('An optional custom system prompt for the LLM.'),
  knowledgeContentFallback: z.string().optional().describe('Fallback content from MongoDB if vector search yields no results or fails.'),
});
export type GenerateAiResponseInput = z.infer<typeof GenerateAiResponseInputSchema>;

const GenerateAiResponseOutputSchema = z.string().describe('The full AI-generated response.');
export type GenerateAiResponseOutput = z.infer<typeof GenerateAiResponseOutputSchema>;

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant for the Nocta chatbot.
Your goal is to provide concise, accurate, and relevant answers based ONLY on the provided context.
If the information is not available in the context, politely state that you don't have enough information.
Avoid making up answers. Do not mention that you are using context.`;

export async function generateAiResponse(
  input: GenerateAiResponseInput
): Promise<AsyncIterable<string>> {
  const { stream } = await aiResponseGenerationFlow(input);
  return stream;
}

const aiResponseGenerationFlow = ai.defineFlow(
  {
    name: 'aiResponseGenerationFlow',
    inputSchema: GenerateAiResponseInputSchema,
    outputSchema: z.object({
      stream: z.any(),
      fullResponse: GenerateAiResponseOutputSchema,
    }),
  },
  async (input) => {
    let contextString = '';

    try {
      const questionEmbedding = await embedContent(input.question);

      const searchResult = await searchKnowledgeChunks(input.userId, questionEmbedding, VECTOR_TOP_K);

      if (searchResult && searchResult.length > 0) {
        contextString = searchResult
          .map((hit) => hit.text)
          .filter(Boolean)
          .join('\n\n');
      } else if (input.knowledgeContentFallback) {
        contextString = input.knowledgeContentFallback;
      }
    } catch (error) {
      console.error('Error during RAG process (embedding or vector search):', error);
      contextString = input.knowledgeContentFallback || 'No specific knowledge base context could be retrieved.';
    }

    const effectiveSystemPrompt = input.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const prompt = `Using the following context, answer the user's question.
If the answer is not found in the context, respond with "I apologize, but I don't have enough information to answer that question based on the provided knowledge base."

Context:
\`\`\`
${contextString}
\`\`\`

Question:
${input.question}`;

    const result = await ai.generateStream({
      prompt,
      config: {
        system: effectiveSystemPrompt,
      },
    } as any);

    const fullResponse = await result.response;
    const textValue = (fullResponse as any).text;
    const fullResponseText = typeof textValue === 'function' ? await textValue.call(fullResponse) : String(textValue || '');

    return { stream: result.stream, fullResponse: fullResponseText };
  }
);
