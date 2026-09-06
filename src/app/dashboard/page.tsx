"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  FileArchive,
  Loader2,
  Plus,
  Radar,
  Search,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { downloadViaBlob, hostnameOf } from "@/lib/download";

interface AnalysisSummary {
  id: string;
  companyId: string;
  companyName: string;
  url: string;
  industry: string | null;
  agentsCount: number;
  summary: string;
  createdAt: string;
}

interface CrawlSummary {
  id: string;
  startUrl: string;
  status: string;
  maxPages: number;
  pagesDone: number;
  pagesFailed: number;
  companyId: string | null;
  companyName: string | null;
  error: string | null;
  createdAt: string;
}

type Tab = "analyses" | "crawls";

const CRAWL_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  queued: { label: "В очереди", className: "bg-accent-gold/10 text-accent-warm" },
  running: { label: "Выполняется", className: "bg-accent-gold/15 text-accent-warm" },
  done: { label: "Завершён", className: "bg-emerald-50 text-emerald-700" },
  error: { label: "Ошибка", className: "bg-red-50 text-red-700" },
  cancelled: { label: "Остановлен", className: "bg-accent-warm/5 text-accent-warm/60" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("analyses");
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [crawls, setCrawls] = useState<CrawlSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingCrawls, setLoadingCrawls] = useState(false);
  const [crawlsLoaded, setCrawlsLoaded] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/analyses");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  async function loadCrawls() {
    setLoadingCrawls(true);
    try {
      const res = await fetch("/api/crawl");
      const data = await res.json();
      setCrawls(data);
    } finally {
      setLoadingCrawls(false);
      setCrawlsLoaded(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of saved analyses on mount
    load();
  }, []);

  // Load crawls when the tab opens; keep polling while a crawl is still running.
  useEffect(() => {
    if (tab !== "crawls") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- crawls load on tab switch
    loadCrawls();
  }, [tab]);

  useEffect(() => {
    const hasActive = crawls.some((c) => c.status === "running" || c.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(loadCrawls, 3000);
    return () => clearInterval(interval);
  }, [crawls]);

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/analyses/${id}`, { method: "DELETE" });
  }

  async function handleDeleteCrawl(id: string) {
    setCrawls((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/crawl/${id}`, { method: "DELETE" });
  }

  const filtered = useMemo(
    () => items.filter((i) => i.companyName.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );

  const filteredCrawls = useMemo(
    () =>
      crawls.filter(
        (c) =>
          c.startUrl.toLowerCase().includes(query.toLowerCase()) ||
          (c.companyName ?? "").toLowerCase().includes(query.toLowerCase())
      ),
    [crawls, query]
  );

  const industryStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.industry ?? "Не определена";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Дашборд</h1>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-2xl bg-accent-warm px-4 py-2.5 text-sm font-medium text-accent-gold-bright shadow-lg shadow-accent-warm/20 transition-all duration-300 hover:bg-accent-warm/90"
          >
            <Plus size={18} /> Новый анализ
          </Link>
        </div>

        {/* Tab switcher: analyses vs site crawls */}
        <div className="mt-6 inline-flex rounded-2xl border border-accent-warm/10 bg-white/60 p-1 shadow-lg shadow-accent-warm/5">
          {(
            [
              ["analyses", "Анализы"],
              ["crawls", "Обходы сайтов"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
                tab === key ? "bg-accent-warm text-accent-gold-bright" : "text-accent-warm/60 hover:text-accent-warm"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-warm/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "analyses" ? "Поиск по названию компании" : "Поиск по адресу сайта"}
            className="w-full rounded-2xl border border-accent-warm/15 bg-white py-3 pl-11 pr-4 text-base outline-none transition-all duration-300 focus:border-accent-gold"
          />
        </div>

        {tab === "analyses" && (
          <>
            {industryStats.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {industryStats.map(([industry, count]) => (
                  <span
                    key={industry}
                    className="rounded-full bg-accent-warm/5 px-3 py-1 text-sm text-accent-warm/70"
                  >
                    {industry} — {count}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {loading && <p className="text-accent-warm/50">Загрузка…</p>}
              {!loading && filtered.length === 0 && (
                <p className="text-accent-warm/50">
                  Пока нет сохранённых анализов.{" "}
                  <Link href="/" className="underline">
                    Проанализировать сайт
                  </Link>
                </p>
              )}
              {filtered.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/company/${item.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/company/${item.id}`)}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-accent-warm/10 bg-white/60 p-4 shadow-lg shadow-accent-warm/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-gold/40"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{item.companyName}</p>
                    <p className="truncate text-sm text-accent-warm/60">
                      <a
                        href={/^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {item.url}
                      </a>{" "}
                      · {item.industry ?? "отрасль не определена"} · {item.agentsCount} агентов
                    </p>
                    <p className="text-xs text-accent-warm/40">
                      {new Date(item.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/company/${item.id}`);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-warm/10 text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
                      title="Открыть"
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-all duration-300 hover:bg-red-100"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "crawls" && (
          <div className="mt-6 space-y-3">
            {loadingCrawls && !crawlsLoaded && <p className="text-accent-warm/50">Загрузка…</p>}
            {crawlsLoaded && filteredCrawls.length === 0 && (
              <p className="text-accent-warm/50">
                Обходов ещё не было.{" "}
                <Link href="/crawler" className="underline">
                  Запустить краулер
                </Link>
              </p>
            )}
            {filteredCrawls.map((crawl) => {
              const status = CRAWL_STATUS_LABELS[crawl.status] ?? CRAWL_STATUS_LABELS.queued;
              const isActive = crawl.status === "running" || crawl.status === "queued";
              return (
                <div
                  key={crawl.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/crawl/${crawl.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/crawl/${crawl.id}`)}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-accent-warm/10 bg-white/60 p-4 shadow-lg shadow-accent-warm/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent-gold/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{crawl.startUrl}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="truncate text-sm text-accent-warm/60">
                      {crawl.companyName && <>«{crawl.companyName}» · </>}
                      спаршено {crawl.pagesDone} из {crawl.maxPages} стр.
                      {crawl.pagesFailed > 0 && ` · пропущено ${crawl.pagesFailed}`}
                    </p>
                    {crawl.error && <p className="truncate text-sm text-red-700">{crawl.error}</p>}
                    <p className="text-xs text-accent-warm/40">
                      {new Date(crawl.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <Loader2
                        size={16}
                        className="animate-spin text-accent-gold"
                      />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadViaBlob(
                          `/api/crawl/${crawl.id}/export?format=zip`,
                          `${hostnameOf(crawl.startUrl)}-crawl.zip`
                        ).catch((err) => console.error("[dashboard] zip download failed:", err));
                      }}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-accent-warm/10 text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
                      title="Скачать ZIP"
                    >
                      <FileArchive size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/crawl/${crawl.id}`);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-warm/10 text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
                      title="Открыть"
                    >
                      <ExternalLink size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCrawl(crawl.id);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600 transition-all duration-300 hover:bg-red-100"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="pt-2">
              <Link
                href="/crawler"
                className="inline-flex items-center gap-2 rounded-2xl border border-accent-warm/20 px-5 py-3 text-sm font-medium text-accent-warm transition-all duration-300 hover:bg-accent-warm/5"
              >
                <Radar size={16} /> Обойти новый сайт
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
