"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ResultsGrid } from "@/components/ResultsGrid";
import type { AnalysisResult } from "@/types/analysis";

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/analyses/${params.id}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Анализ не найден.");
        else setResult(data as AnalysisResult);
      } catch {
        if (!cancelled) setError("Не удалось загрузить анализ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-sm text-accent-warm/70 transition-all duration-300 hover:text-accent-warm"
        >
          <ArrowLeft size={18} /> Назад к дашборду
        </button>

        {loading && (
          <div className="mt-8 flex items-center gap-2 text-accent-warm/60">
            <Loader2 size={18} className="animate-spin" /> Загрузка анализа…
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {result && (
          <div className="mt-6">
            <ResultsGrid result={result} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
