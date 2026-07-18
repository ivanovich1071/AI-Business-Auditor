import { z } from "zod";

export const AgentSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  benefits: z.array(z.string()),
  why: z.string(),
  priority: z.number().min(1).max(10),
});
export type AgentSuggestion = z.infer<typeof AgentSuggestionSchema>;

export const IndustryAnalysisSchema = z.object({
  industry: z.string().nullable(),
  business_processes: z.array(z.string()).default([]),
  pains: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).nullable().default(null),
  sources: z.array(z.string()).default([]),
  message: z.string().optional(),
});
export type IndustryAnalysis = z.infer<typeof IndustryAnalysisSchema>;

export const AgentsResponseSchema = z.object({
  agents: z.array(AgentSuggestionSchema),
  summary: z.string(),
});
export type AgentsResponse = z.infer<typeof AgentsResponseSchema>;

export const ChatAnswerSchema = z.object({
  answer: z.string(),
});
export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;

export interface McpData {
  industry: string | null;
  company_name: string | null;
  size: string | null;
  contacts: string[];
  other: string | null;
  warnings: string[];
}

export interface AnalysisResult {
  id: string;
  companyId: string;
  companyName: string;
  url: string;
  industry: string | null;
  description: string | null;
  businessProcesses: string[];
  pains: string[];
  confidence: number | null;
  agents: AgentSuggestion[];
  summary: string;
  createdAt: string;
  warnings: string[];
}
