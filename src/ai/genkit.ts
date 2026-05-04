import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// FIXED: googleAI() reads GOOGLE_GENAI_API_KEY from env
// Make sure .env.local has: GOOGLE_GENAI_API_KEY=your_key
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});