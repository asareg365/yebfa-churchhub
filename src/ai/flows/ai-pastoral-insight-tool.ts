'use server';
/**
 * @fileOverview An AI-powered tool that analyzes church attendance and financial contribution trends to suggest personalized outreach strategies.
 *
 * - aiPastoralInsightTool - A function that handles the analysis and strategy generation process.
 * - AIPastoralInsightInput - The input type for the aiPastoralInsightTool function.
 * - AIPastoralInsightOutput - The return type for the aiPastoralInsightTool function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AIPastoralInsightInputSchema = z.object({
  churchName: z.string().describe('The name of the church or religious organization.'),
  attendanceRecords: z.array(
    z.object({
      date: z.string().describe('The date of the attendance record (YYYY-MM-DD).'),
      count: z.number().int().describe('The number of attendees for that date.'),
    })
  ).describe('A list of historical attendance records.'),
  financialRecords: z.array(
    z.object({
      date: z.string().describe('The date of the financial record (YYYY-MM-DD).'),
      amount: z.number().describe('The amount of the financial contribution.'),
      type: z.string().describe('The type of contribution (e.g., "Tithe", "Offering", "Donation").'),
    })
  ).describe('A list of historical financial contribution records.'),
  currentChallenges: z.string().optional().describe('Optional: Any specific challenges or concerns the church is currently facing.'),
  desiredOutcomes: z.string().optional().describe('Optional: Specific outcomes the church hopes to achieve (e.g., "Increase youth engagement", "Improve new member retention").'),
});
export type AIPastoralInsightInput = z.infer<typeof AIPastoralInsightInputSchema>;

const AIPastoralInsightOutputSchema = z.object({
  summaryInsight: z.string().describe('An overall summary of the AI\'s analysis of the church\'s trends.'),
  growthStrategies: z.array(z.string()).describe('A list of actionable strategies to foster congregation growth.'),
  engagementRecommendations: z.array(z.string()).describe('A list of specific recommendations for improving member engagement.'),
  potentialRisks: z.array(z.string()).describe('Any identified potential risks or areas that require immediate attention based on the data.'),
});
export type AIPastoralInsightOutput = z.infer<typeof AIPastoralInsightOutputSchema>;

export async function aiPastoralInsightTool(input: AIPastoralInsightInput): Promise<AIPastoralInsightOutput> {
  return aiPastoralInsightFlow(input);
}

const aiPastoralInsightPrompt = ai.definePrompt({
  name: 'aiPastoralInsightPrompt',
  input: { schema: AIPastoralInsightInputSchema },
  output: { schema: AIPastoralInsightOutputSchema },
  prompt: `You are an AI-powered pastoral consultant for Yebfa ChurchHub. Your role is to analyze a church's attendance and financial contribution data to provide personalized, actionable outreach strategies aimed at fostering congregation growth and member engagement.\n\nChurch Name: {{{churchName}}}\n\nAttendance Records:\n{{#each attendanceRecords}}\n  - Date: {{{this.date}}}, Count: {{{this.count}}}\n{{/each}}\n\nFinancial Contribution Records:\n{{#each financialRecords}}\n  - Date: {{{this.date}}}, Amount: {{{this.amount}}}, Type: {{{this.type}}}\n{{/each}}\n\n{{#if currentChallenges}}\nCurrent Challenges: {{{currentChallenges}}}\n{{/if}}\n\n{{#if desiredOutcomes}}\nDesired Outcomes: {{{desiredOutcomes}}}\n{{/if}}\n\nBased on the provided data, analyze the trends in attendance and financial contributions. Identify strengths, weaknesses, opportunities, and potential threats. Then, generate a concise summary of your insights, a list of actionable strategies for congregation growth, specific recommendations for improving member engagement, and any potential risks the church should be aware of.\n\nEnsure your output adheres strictly to the specified JSON schema.`,
});

const aiPastoralInsightFlow = ai.defineFlow(
  {
    name: 'aiPastoralInsightFlow',
    inputSchema: AIPastoralInsightInputSchema,
    outputSchema: AIPastoralInsightOutputSchema,
  },
  async (input) => {
    const { output } = await aiPastoralInsightPrompt(input);
    if (!output) {
      throw new Error("AI did not return a valid output for pastoral insights.");
    }
    return output;
  }
);
