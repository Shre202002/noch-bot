
import { ai } from "@/ai/genkit";

/**
 * Generates an embedding vector for the provided text using Gemini's text-embedding-004 model.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await ai.embed({
    model: 'googleai/text-embedding-004',
    content: [{ text }],
  });
  if (!response.embedding) {
    throw new Error("Failed to generate embedding");
  }
  return response.embedding;
}

/**
 * Alias for embedText to maintain compatibility with different naming conventions in the app.
 */
export const embedContent = embedText;
