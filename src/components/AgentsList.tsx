"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import { AgentCard } from "./AgentCard";

export function AgentsList({
  result,
  department,
}: {
  result: AnalysisResult;
  department: string | null;
}) {
  const agents = useMemo(() => {
    const sorted = result.agents.slice().sort((a, b) => b.priority - a.priority);
    if (!department) return sorted;
    const filtered = sorted.filter((a) => a.department === department);
    // If the model didn't tag agents for this department, fall back to all.
    return filtered.length > 0 ? filtered : sorted;
  }, [result.agents, department]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-accent-warm/10 bg-white/40 p-5 shadow-lg shadow-accent-warm/5">
      <div className="flex items-center gap-2 text-accent-warm">
        <Sparkles size={18} />
        <h2 className="text-lg font-semibold">Рекомендуемые AI-агенты</h2>
      </div>
      <p className="mt-1 text-xs text-accent-warm/50">{result.summary}</p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {agents.map((agent, i) => (
          <AgentCard key={agent.name + i} agent={agent} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
