"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Radar } from "lucide-react";

interface CrawlSummary {
  id: string;
  startUrl: string;
  status: string;
  maxPages: number;
  pagesDone: number;
  pagesFailed: number;
  companyId: string | null;
  createdAt: string;
}

const CRAWL_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  queued: { label: "В очереди", className: "bg-accent-gold/10 text-accent-warm" },
  running: { label: "Выполняется", className: "bg-accent-gold/15 text-accent-warm" },
  done: { label: "Завершён", className: "bg-emerald-50 text-emerald-700" },
  error: { label: "Ошибка", className: "bg-red-50 text-red-700" },
  cancelled: { label: "Остановлен", className: "bg-accent-warm/5 text-accent-warm/60" },
};

function hostnameOf(rawUrl: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
      .hostname.replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

export function CompanyCrawls({ url, companyId }: { url: string; companyId: string | null }) {
  const router = useRouter();
  const [crawls, setCrawls] = useState<CrawlSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const host = hostnameOf(url);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crawl");
      const data: CrawlSummary[] = await res.json();
      setCrawls(data.filter((c) => hostnameOf(c.startUrl) === host));
    } catch {
      // listing is optional — swallow
    } finally {
      setLoading(false);
    }
  }, [host]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial crawls fetch on mount
    load();
  }, [load]);

  useEffect(() => {
    const hasActive = crawls.some((c) => c.status === "running" || c.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-evaluate activity on each crawls update
  }, [crawls]);

  async function handleLaunch() {
    if (launching) return;
    setError(null);
    setLaunching(true);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, companyId: companyId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось запустить обход.");
        return;
      }
      router.push(`/crawl/${data.id}`);
    } catch {
      setError("Не удалось запустить обход.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-accent-warm/10 bg-white/40 p-5 shadow-lg shadow-accent-warm/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-accent-warm">
            <Radar size={17} /> Обходы сайта
          </h2>
          <p className="mt-1 text-xs text-accent-warm/50">
            Полный обход всех разделов сайта в формате Markdown
          </p>
        </div>
        <button
          onClick={handleLaunch}
          disabled={launching}
          className="flex items-center gap-2 rounded-2xl bg-accent-warm px-4 py-2.5 text-sm font-medium text-accent-gold-bright shadow-lg shadow-accent-warm/20 transition-all duration-300 hover:bg-accent-warm/90 disabled:opacity-40"
        >
          {launching ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Запускаем…
            </>
          ) : (
            <>
              <Radar size={16} /> Обойти весь сайт
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mt-4 space-y-2">
        {loading && <p className="text-sm text-accent-warm/50">Загрузка…</p>}
        {!loading && crawls.length === 0 && (
          <p className="text-sm text-accent-warm/50">Этот сайт ещё не обходили.</p>
        )}
        {crawls.map((crawl) => {
          const status = CRAWL_STATUS_LABELS[crawl.status] ?? CRAWL_STATUS_LABELS.queued;
          return (
            <div
              key={crawl.id}
              className="flex items-center justify-between rounded-xl border border-accent-warm/10 bg-white/60 px-3 py-2"
            >
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                  <span className="text-accent-warm/70">
                    {crawl.pagesDone} стр. · {new Date(crawl.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/crawl/${crawl.id}`)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-warm/10 text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
                title="Открыть просмотрщик"
              >
                <ExternalLink size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
