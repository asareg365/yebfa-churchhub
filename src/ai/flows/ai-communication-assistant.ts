'use server';
/**
 * @fileOverview An AI assistant for generating tailored draft messages for communication channels.
 *
 * - aiCommunicationAssistant - A function that generates a tailored draft message.
 * - AICommunicationAssistantInput - The input type for the aiCommunicationAssistant function.
 * - AICommunicationAssistantOutput - The return type for the aiCommunicationAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AICommunicationAssistantInputSchema = z.object({
  topic: z.string().describe('The main topic or subject of the message.'),
  targetAudience: z
    .string()
    .describe('The specific group of people the message is intended for (e.g., \"youth group,\" \"church elders,\" \"all members\").'),
});
export type AICommunicationAssistantInput = z.infer<typeof AICommunicationAssistantInputSchema>;

const AICommunicationAssistantOutputSchema = z.object({
  draftMessage: z
    .string()
    .describe('The generated draft message, tailored for the given topic and target audience.'),
});
export type AICommunicationAssistantOutput = z.infer<typeof AICommunicationAssistantOutputSchema>;

export async function aiCommunicationAssistant(input: AICommunicationAssistantInput): Promise<AICommunicationAssistantOutput> {
  return aiCommunicationAssistantFlow(input);
}

const aiCommunicationAssistantPrompt = ai.definePrompt({
  name: 'aiCommunicationAssistantPrompt',
  input: {schema: AICommunicationAssistantInputSchema},
  output: {schema: AICommunicationAssistantOutputSchema},
  prompt: `You are an AI assistant designed to help church administrators draft messages.
Your goal is to create a tailored and effective draft message for bulk SMS, email campaigns, or announcements.

Instructions:
1.  Generate a concise and engaging message that effectively conveys the 'topic'.
2.  Tailor the tone and content specifically for the 'targetAudience'.
3.  Ensure the message is versatile enough to be used across various communication channels (SMS, email, announcements).

Topic: {{{topic}}}
Target Audience: {{{targetAudience}}}

Generate the draft message below:`,
});

const aiCommunicationAssistantFlow = ai.defineFlow(
  {
    name: 'aiCommunicationAssistantFlow',
    inputSchema: AICommunicationAssistantInputSchema,
    outputSchema: AICommunicationAssistantOutputSchema,
  },
  async input => {
    const {output} = await aiCommunicationAssistantPrompt(input);
    return output!;
  }
);
