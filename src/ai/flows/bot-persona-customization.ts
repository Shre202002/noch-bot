'use server';
/**
 * @fileOverview Defines the Genkit flow for customizing a chatbot's persona.
 *
 * - botPersonaCustomization - A function that handles the definition of a chatbot's persona.
 * - BotPersonaCustomizationInput - The input type for the botPersonaCustomization function.
 * - BotPersonaCustomizationOutput - The return type for the botPersonaCustomization function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/**
 * Input schema for defining a chatbot's persona.
 * Includes the desired bot name and the system prompt to guide its behavior.
 */
const BotPersonaCustomizationInputSchema = z.object({
  botName: z.string().min(1).describe('The desired name for the chatbot.'),
  systemPrompt: z.string().min(1).describe('The custom system prompt that defines the chatbot\'s personality, tone, and instructions.'),
});
export type BotPersonaCustomizationInput = z.infer<typeof BotPersonaCustomizationInputSchema>;

/**
 * Output schema for the bot persona customization flow.
 * It echoes the confirmed bot name and system prompt, acting as a confirmation of the settings.
 */
const BotPersonaCustomizationOutputSchema = z.object({
  botName: z.string().describe('The name of the chatbot after customization.'),
  systemPrompt: z.string().describe('The system prompt of the chatbot after customization.'),
});
export type BotPersonaCustomizationOutput = z.infer<typeof BotPersonaCustomizationOutputSchema>;

/**
 * Defines a prompt that acts as an AI assistant for configuring chatbot personas.
 * Its primary role here is to process and confirm the provided bot name and system prompt
 * in the expected output format.
 */
const personaConfirmationPrompt = ai.definePrompt({
  name: 'personaConfirmationPrompt',
  input: { schema: BotPersonaCustomizationInputSchema },
  output: { schema: BotPersonaCustomizationOutputSchema },
  prompt: `You are an AI assistant designed to help users configure their chatbots.

A user is attempting to set up a new persona for their chatbot.

The user has provided the following details:
Bot Name: "{{{botName}}}"
System Prompt: "{{{systemPrompt}}}"

Your task is to confirm and echo these settings back in the specified JSON format.`,
});

/**
 * Implements the Genkit flow for customizing a chatbot's persona.
 * This flow takes a bot name and system prompt as input, and uses an AI model
 * to confirm and structure these settings, preparing them for downstream use or persistence.
 */
const botPersonaCustomizationFlow = ai.defineFlow(
  {
    name: 'botPersonaCustomizationFlow',
    inputSchema: BotPersonaCustomizationInputSchema,
    outputSchema: BotPersonaCustomizationOutputSchema,
  },
  async (input) => {
    // Calls the prompt to process and confirm the persona settings.
    // This step leverages the LLM to validate input against the output schema,
    // or can be extended for more complex AI-driven validation or enhancements.
    const { output } = await personaConfirmationPrompt(input);
    if (!output) {
      throw new Error('Failed to confirm bot persona customization.');
    }
    return output;
  }
);

/**
 * Wrapper function to execute the bot persona customization Genkit flow.
 * @param input The desired bot name and system prompt for the chatbot.
 * @returns A promise that resolves to the confirmed bot persona settings.
 */
export async function botPersonaCustomization(input: BotPersonaCustomizationInput): Promise<BotPersonaCustomizationOutput> {
  return botPersonaCustomizationFlow(input);
}
