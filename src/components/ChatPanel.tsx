"use client";

import { useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function ChatPanel({ result }: { result: AnalysisResult }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context: {
            companyName: result.companyName,
            industry: result.industry,
            businessProcesses: result.businessProcesses,
            agents: result.agents.map((a) => ({ name: a.name, priority: a.priority })),
          },
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer ?? "Извините, произошла ошибка. Попробуйте ещё раз." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Извините, произошла ошибка. Попробуйте ещё раз." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-accent-warm/10 bg-white/40 p-6 shadow-lg shadow-accent-warm/5">
      <div className="flex items-center gap-2 text-accent-warm">
        <MessageCircle size={18} />
        <h3 className="text-lg font-semibold">Обсудить результаты</h3>
      </div>
      <p className="mt-1 text-xs text-accent-warm/50">
        Вопросы строго по анализу «{result.companyName}» — история не сохраняется после закрытия вкладки.
      </p>

      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-accent-warm/50">
            Например: «Какой агент подойдёт для автоматизации отчётов?»
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl px-4 py-2 text-sm transition-all duration-300 ${
              m.role === "user"
                ? "ml-auto max-w-[80%] bg-accent-warm text-white"
                : "mr-auto max-w-[80%] bg-accent-warm/5 text-foreground/90"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="mr-auto max-w-[80%] rounded-2xl bg-accent-warm/5 px-4 py-2 text-sm text-accent-warm/50">Печатает…</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="Задайте вопрос по анализу…"
          className="flex-1 rounded-xl border border-accent-warm/15 bg-white px-4 py-2 text-sm outline-none transition-all duration-300 focus:border-accent-gold"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-warm text-accent-gold-bright transition-all duration-300 hover:bg-accent-warm/90 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
