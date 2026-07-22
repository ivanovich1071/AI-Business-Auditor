"use client";

import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function storageKey(result: AnalysisResult): string {
  return `aiba:chat:${result.companyId ?? `url:${result.url}`}`;
}

export function ChatPanel({ result }: { result: AnalysisResult }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const key = storageKey(result);

  // Hydrate history from localStorage (persists across tab close, per company).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate per company
      setMessages(raw ? (JSON.parse(raw) as ChatMessage[]) : []);
    } catch {
      // ignore corrupted cache
    }
  }, [key]);

  useEffect(() => {
    try {
      if (messages.length > 0) localStorage.setItem(key, JSON.stringify(messages));
    } catch {
      // ignore quota errors
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, key]);

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
            businessProcesses: result.businessProcesses.map((p) => p.name),
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
    <div className="flex h-full flex-col rounded-3xl border border-accent-warm/10 bg-white/40 p-5 shadow-lg shadow-accent-warm/5">
      <div className="flex items-center gap-2 text-accent-warm">
        <MessageCircle size={18} />
        <h2 className="text-lg font-semibold">Обсудить результаты</h2>
      </div>
      <p className="mt-1 text-xs text-accent-warm/50">
        Вопросы строго по анализу «{result.companyName}». История сохраняется в этом браузере.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
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
                ? "ml-auto max-w-[85%] bg-accent-warm text-white"
                : "mr-auto max-w-[85%] bg-accent-warm/5 text-foreground/90"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="mr-auto max-w-[85%] rounded-2xl bg-accent-warm/5 px-4 py-2 text-sm text-accent-warm/50">
            Печатает…
          </div>
        )}
        <div ref={bottomRef} />
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
