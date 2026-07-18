import { AlertTriangle, Building2 } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import { AgentCard } from "./AgentCard";

export function ResultsArea({ result }: { result: AnalysisResult }) {
  return (
    <div className="max-h-[520px] overflow-y-auto rounded-3xl border border-accent-warm/10 bg-white/40 p-6 shadow-lg shadow-accent-warm/5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-warm text-accent-gold-bright">
          <Building2 size={18} />
        </span>
        <div>
          <h2 className="text-xl font-semibold">{result.companyName}</h2>
          <p className="text-sm text-accent-warm/60">{result.url}</p>
        </div>
      </div>

      {result.industry && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent-gold/15 px-3 py-1 text-sm font-medium text-accent-warm">
            Отрасль: {result.industry}
          </span>
          {result.confidence != null && (
            <span className="rounded-full bg-accent-warm/10 px-3 py-1 text-sm text-accent-warm/70">
              Уверенность: {Math.round(result.confidence * 100)}%
            </span>
          )}
        </div>
      )}

      {result.businessProcesses.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-accent-warm/70">Бизнес-процессы:</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {result.businessProcesses.map((p, i) => (
              <span key={i} className="rounded-full bg-accent-warm/5 px-3 py-1 text-sm">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl bg-accent-gold/10 p-3 text-sm text-accent-warm"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 text-base leading-relaxed text-foreground/85">{result.summary}</p>

      <div className="mt-6 space-y-4">
        {result.agents
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((agent, i) => (
            <AgentCard key={agent.name + i} agent={agent} rank={i + 1} />
          ))}
      </div>
    </div>
  );
}
