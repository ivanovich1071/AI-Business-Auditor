import { Bot } from "lucide-react";
import type { AgentSuggestion } from "@/types/analysis";

export function AgentCard({ agent, rank }: { agent: AgentSuggestion; rank: number }) {
  return (
    <div className="rounded-2xl border border-accent-warm/10 bg-white/60 p-5 shadow-lg shadow-accent-warm/5 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-warm/10 text-accent-warm">
            <Bot size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-accent-warm/50">#{rank}</p>
            <h3 className="text-lg font-semibold">{agent.name}</h3>
            {agent.department && (
              <span className="mt-1 inline-block rounded-full bg-accent-warm/5 px-2 py-0.5 text-xs text-accent-warm/60">
                {agent.department}
              </span>
            )}
          </div>
        </div>
        <span className="rounded-full bg-accent-gold/15 px-3 py-1 text-sm font-semibold text-accent-warm">
          {agent.priority}/10
        </span>
      </div>
      <p className="mt-3 text-sm text-foreground/80">{agent.description}</p>
      {agent.benefits.length > 0 && (
        <ul className="mt-3 space-y-1">
          {agent.benefits.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground/70">
              <span className="text-accent-gold">•</span>
              {b}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 rounded-xl bg-accent-warm/5 p-3 text-sm text-accent-warm/80">
        <span className="font-medium">Почему подходит: </span>
        {agent.why}
      </p>
    </div>
  );
}
