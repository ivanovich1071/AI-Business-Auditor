"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Save, Check, Loader2, Radar } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProgressBar } from "@/components/ProgressBar";
import { ResultsGrid } from "@/components/ResultsGrid";
import type { AnalysisResult } from "@/types/analysis";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Каждый заход на страницу начинается с чистого листа — результат прошлого
  // анализа не восстанавливается (в дашборде он есть, если был сохранён).

  async function handleAnalyze() {
    const trimmedUrl = url.trim();
    const trimmedName = name.trim();
    if ((!trimmedUrl && !trimmedName) || loading) return;
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
        body: JSON.stringify({ url: trimmedUrl || undefined, name: trimmedName || undefined }),
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

  async function handleSave() {
    if (!result || result.saved || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (res.ok) {
        const saved = (await res.json()) as AnalysisResult;
        setResult(saved);
      }
    } finally {
      setSaving(false);
    }
  }

  // Launch a full-site crawl for the analyzed company: saves the analysis first so
  // both results (analysis + crawl) end up in the dashboard linked to one company.
  async function handleCrawl() {
    if (!result || crawling) return;
    setError(null);
    setCrawling(true);
    try {
      let saved = result;
      if (!result.saved) {
        const saveRes = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result),
        });
        if (saveRes.ok) {
          saved = (await saveRes.json()) as AnalysisResult;
          setResult(saved);
        }
      }
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: saved.url, companyId: saved.companyId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось запустить обход. Попробуйте ещё раз.");
        return;
      }
      router.push(`/crawl/${data.id}`);
    } catch {
      setError("Не удалось запустить обход. Попробуйте ещё раз.");
    } finally {
      setCrawling(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Найдите AI-агентов для своего бизнеса
          </h1>
          <p className="mt-2 text-accent-warm/60">
            Введите URL сайта и/или название компании — проанализируем бизнес и подберём AI-решения
          </p>
        </div>

        {/* Input block — left-aligned, URL + company name */}
        <div className="mt-6 max-w-3xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-warm/40" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="URL сайта, напр. example.com"
                className="w-full rounded-2xl border border-accent-warm/15 bg-white py-3 pl-11 pr-4 text-base outline-none transition-all duration-300 focus:border-accent-gold"
              />
            </div>
            <div className="relative flex-1">
              <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-warm/40" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="Название компании (необязательно)"
                className="w-full rounded-2xl border border-accent-warm/15 bg-white py-3 pl-11 pr-4 text-base outline-none transition-all duration-300 focus:border-accent-gold"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleAnalyze}
              disabled={loading || (!url.trim() && !name.trim())}
              className="rounded-2xl bg-accent-warm px-6 py-3 text-base font-medium text-accent-gold-bright shadow-lg shadow-accent-warm/20 transition-all duration-300 hover:bg-accent-warm/90 disabled:opacity-40"
            >
              Проанализировать
            </button>
            {result && (
              <button
                onClick={handleSave}
                disabled={result.saved || saving}
                className="flex items-center gap-2 rounded-2xl border border-accent-warm/20 px-5 py-3 text-sm font-medium text-accent-warm transition-all duration-300 hover:bg-accent-warm/5 disabled:opacity-70"
              >
                {result.saved ? (
                  <>
                    <Check size={16} className="text-accent-gold" /> Сохранено в дашборд
                  </>
                ) : saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Сохраняем…
                  </>
                ) : (
                  <>
                    <Save size={16} /> Сохранить в дашборд
                  </>
                )}
              </button>
            )}
            {result && (
              <button
                onClick={handleCrawl}
                disabled={crawling}
                className="flex items-center gap-2 rounded-2xl border border-accent-warm/20 px-5 py-3 text-sm font-medium text-accent-warm transition-all duration-300 hover:bg-accent-warm/5 disabled:opacity-70"
                title="Сохранит анализ и запустит полный обход сайта в Markdown"
              >
                {crawling ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Запускаем обход…
                  </>
                ) : (
                  <>
                    <Radar size={16} /> Обойти весь сайт
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="mt-6 max-w-3xl">
            <ProgressBar stage={stage} />
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-3xl rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {notice && (
          <div className="mt-6 max-w-3xl rounded-2xl bg-accent-gold/10 p-4 text-sm text-accent-warm">
            {notice}
          </div>
        )}

        {result && (
          <div className="mt-8">
            <ResultsGrid result={result} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
