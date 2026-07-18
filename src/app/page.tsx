"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Save, Check } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProgressBar } from "@/components/ProgressBar";
import { ResultsArea } from "@/components/ResultsArea";
import { ChatPanel } from "@/components/ChatPanel";
import type { AnalysisResult } from "@/types/analysis";

const STORAGE_KEY = "aiba:lastResult";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from sessionStorage on mount
        setResult(JSON.parse(cached));
      } catch {
        // ignore corrupted cache
      }
    }
  }, []);

  useEffect(() => {
    if (result) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    }
  }, [result]);

  async function handleAnalyze() {
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    setError(null);
    setNotice(null);
    setResult(null);
    setLoading(true);
    setStage(0);

    stageTimer.current = setInterval(() => {
      setStage((s) => Math.min(s + 1, 3));
    }, 2500);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Извините, произошла ошибка. Попробуйте ещё раз.");
        return;
      }
      if (!data.industry && data.message) {
        setNotice(data.message);
        return;
      }
      setResult(data as AnalysisResult);
    } catch {
      setError("Сайт недоступен. Проверьте URL или попробуйте позже.");
    } finally {
      setLoading(false);
      if (stageTimer.current) clearInterval(stageTimer.current);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Найдите AI-агентов для своего бизнеса
          </h1>
          <p className="mt-2 text-accent-warm/60">
            Введите URL сайта — мы проанализируем бизнес и подберём подходящие AI-решения
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-warm/40" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAnalyze();
              }}
              placeholder="example.com"
              className="w-full rounded-2xl border border-accent-warm/15 bg-white py-3 pl-11 pr-4 text-base outline-none transition-all duration-300 focus:border-accent-gold"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            className="rounded-2xl bg-accent-warm px-6 py-3 text-base font-medium text-accent-gold-bright shadow-lg shadow-accent-warm/20 transition-all duration-300 hover:bg-accent-warm/90 disabled:opacity-40"
          >
            Проанализировать
          </button>
        </div>

        {loading && (
          <div className="mt-6">
            <ProgressBar stage={stage} />
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 transition-all duration-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-6 rounded-2xl bg-accent-gold/10 p-4 text-sm text-accent-warm transition-all duration-300">
            {notice}
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-6">
            <div className="flex justify-end">
              <span className="flex items-center gap-2 rounded-full bg-accent-warm/5 px-4 py-2 text-sm text-accent-warm/70">
                <Check size={16} className="text-accent-gold" />
                Сохранено в дашборд
                <Save size={14} />
              </span>
            </div>
            <ResultsArea result={result} />
            <ChatPanel result={result} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
