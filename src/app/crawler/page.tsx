"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Radar } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function CrawlerPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(200);
  const [maxDepth, setMaxDepth] = useState(5);
  const [respectRobots, setRespectRobots] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, maxPages, maxDepth, respectRobots }),
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
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Краулер сайта</h1>
          <p className="mt-2 text-accent-warm/60">
            Полный обход всех разделов, подразделов и вкладок сайта с конвертацией каждой страницы в
            Markdown. Спаршенный контент можно смотреть онлайн, скачать архивом и одним файлом.
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-accent-warm/10 bg-white/60 p-6 shadow-lg shadow-accent-warm/5">
          <label className="text-sm font-medium text-accent-warm/70">Адрес сайта</label>
          <div className="relative mt-2">
            <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-warm/40" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="URL сайта, напр. example.com"
              className="w-full rounded-2xl border border-accent-warm/15 bg-white py-3 pl-11 pr-4 text-base outline-none transition-all duration-300 focus:border-accent-gold"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-accent-warm/70">Макс. страниц</label>
              <input
                type="number"
                min={1}
                max={500}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value) || 200)}
                className="mt-2 w-full rounded-2xl border border-accent-warm/15 bg-white px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-accent-gold"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-accent-warm/70">Глубина</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number(e.target.value) || 5)}
                className="mt-2 w-full rounded-2xl border border-accent-warm/15 bg-white px-4 py-2.5 text-sm outline-none transition-all duration-300 focus:border-accent-gold"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-accent-warm/70">robots.txt</label>
              <button
                type="button"
                onClick={() => setRespectRobots((v) => !v)}
                className={`mt-2 w-full rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                  respectRobots
                    ? "border-accent-gold/40 bg-accent-gold/10 text-accent-warm"
                    : "border-accent-warm/15 bg-white text-accent-warm/50 hover:bg-accent-warm/5"
                }`}
              >
                {respectRobots ? "Учитывать" : "Игнорировать"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleStart}
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 rounded-2xl bg-accent-warm px-6 py-3 text-base font-medium text-accent-gold-bright shadow-lg shadow-accent-warm/20 transition-all duration-300 hover:bg-accent-warm/90 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Запускаем…
                </>
              ) : (
                <>
                  <Radar size={18} /> Запустить обход
                </>
              )}
            </button>
            <span className="text-xs text-accent-warm/50">
              Учитывается sitemap.xml; запросы идут с паузой, чтобы не перегружать сайт
            </span>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
