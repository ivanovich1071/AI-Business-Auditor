import { z } from "zod";

export const AgentSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  benefits: z.array(z.string()),
  why: z.string(),
  priority: z.number().min(1).max(10),
  department: z.string().nullable().default(null),
});
export type AgentSuggestion = z.infer<typeof AgentSuggestionSchema>;

export const BusinessProcessSchema = z.object({
  name: z.string(),
  department: z.string().nullable().default(null),
});
export type BusinessProcess = z.infer<typeof BusinessProcessSchema>;

export const IndustryAnalysisSchema = z.object({
  industry: z.string().nullable(),
  business_processes: z.array(BusinessProcessSchema).default([]),
  departments: z.array(z.string()).default([]),
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

export const ProcessDetailSchema = z.object({
  description: z.string(),
  tasks: z.array(z.string()).default([]),
  results: z.array(z.string()).default([]),
  department: z.string().nullable().default(null),
});
export type ProcessDetail = z.infer<typeof ProcessDetailSchema>;

export interface McpData {
  industry: string | null;
  company_name: string | null;
  size: string | null;
  contacts: string[];
  other: string | null;
  warnings: string[];
}

export interface AnalysisResult {
  id: string | null; // null until saved to dashboard
  companyId: string | null;
  companyName: string;
  url: string;
  industry: string | null;
  description: string | null;
  businessProcesses: BusinessProcess[];
  departments: string[];
  pains: string[];
  confidence: number | null;
  agents: AgentSuggestion[];
  summary: string;
  createdAt: string;
  warnings: string[];
  saved: boolean;
}

/**
 * Older saved analyses stored businessProcesses as string[] and had no
 * departments. Normalize any shape into the current BusinessProcess[] form.
 */
export function normalizeBusinessProcesses(raw: unknown): BusinessProcess[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { name: item, department: null };
    if (item && typeof item === "object" && "name" in item) {
      const obj = item as { name: unknown; department?: unknown };
      return {
        name: String(obj.name),
        department: typeof obj.department === "string" ? obj.department : null,
      };
    }
    return { name: String(item), department: null };
  });
}

export function normalizeAgents(raw: unknown): AgentSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const parsed = z.array(AgentSuggestionSchema).safeParse(raw);
  if (parsed.success) return parsed.data;
  // Best-effort: coerce loose objects (older records without `department`).
  return raw
    .map((item) => AgentSuggestionSchema.safeParse(item))
    .filter((r): r is { success: true; data: AgentSuggestion } => r.success)
    .map((r) => r.data);
}
