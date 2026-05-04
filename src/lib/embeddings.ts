// Uses Gemini REST API directly — bypasses Genkit entirely.
// This is more reliable and avoids any Genkit config issues.
// Reads GEMINI_API_KEY from .env.local

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
// const EMBED_MODEL = 'gemini-embedding-001';
// const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

const EMBED_MODEL = 'gemini-embedding-001';  // change from text-embedding-004
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;


export async function embedText(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini embedding failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const vector = data?.embedding?.values;

  if (!vector || !Array.isArray(vector)) {
    throw new Error('Invalid embedding response from Gemini');
  }

  return vector;
}

// Alias for compatibility
export const embedContent = embedText;