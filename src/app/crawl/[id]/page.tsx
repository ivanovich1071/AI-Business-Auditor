"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileArchive,
  FileText,
  Loader2,
  OctagonX,
  Search,
} from "lucide-react";

import { MarkdownView } from "@/components/MarkdownView";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface CrawlPageMeta {
  id: string;
  url: string;
  title: string | null;
  depth: number;
  statusCode: number | null;
}

interface CrawlJobData {
  id: string;
  startUrl: string;
  status: string;
  maxPages: number;
  maxDepth: number;
  pagesDone: number;
  pagesFailed: number;
  error: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
  finishedAt: string | null;
  pages: CrawlPageMeta[];
}

interface PageContent {
  id: string;
  url: string;
  title: string | null;
  markdown: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  queued: { label: "В очереди", className: "bg-accent-gold/10 text-accent-warm" },
  running: { label: "Выполняется", className: "bg-accent-gold/15 text-accent-warm" },
  done: { label: "Завершён", className: "bg-emerald-50 text-emerald-700" },
  error: { label: "Ошибка", className: "bg-red-50 text-red-700" },
  cancelled: { label: "Остановлен", className: "bg-accent-warm/5 text-accent-warm/60" },
};

function sectionOf(pageUrl: string): string {
  try {
    const segment = new URL(pageUrl).pathname.split("/").filter(Boolean)[0];
    return segment ? segment.toLowerCase() : "Главная";
  } catch {
    return "Прочее";
  }
}

export default function CrawlViewerPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [job, setJob] = useState<CrawlJobData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [search, setSearch] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live progress: poll while the crawl is queued/running, stop when finished.
  useEffect(() => {
    if (!id) return;
    let disposed = false;
    async function tick() {
      try {
        const res = await fetch(`/api/crawl/${id}`);
        if (!res.ok) {
          if (res.status === 404 && !disposed) setNotFound(true);
          return;
        }
        const data: CrawlJobData = await res.json();
        if (disposed) return;
        setJob(data);
        if (data.status !== "running" && data.status !== "queued" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // transient network error — next tick will retry
      }
    }
    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => {
      disposed = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  // Auto-open the first page once content is available.
  useEffect(() => {
    if (!selectedId && job && job.pages.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default selection for fresh crawl data
      setSelectedId(job.pages[0].id);
    }
  }, [job, selectedId]);

  useEffect(() => {
    if (!id || !selectedId) return;
    let disposed = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start spinner before the fetch chain
    setLoadingPage(true);
    fetch(`/api/crawl/${id}/pages/${selectedId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("not found"))))
      .then((data: PageContent) => {
        if (!disposed) setPageContent(data);
      })
      .catch(() => {
        if (!disposed) setPageContent(null);
      })
      .finally(() => {
        if (!disposed) setLoadingPage(false);
      });
    return () => {
      disposed = true;
    };
  }, [id, selectedId]);

  const groups = useMemo(() => {
    const filtered = (job?.pages ?? []).filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.title ?? "").toLowerCase().includes(q) || p.url.toLowerCase().includes(q)
      );
    });
    const map = new Map<string, CrawlPageMeta[]>();
    for (const page of filtered) {
      const key = sectionOf(page.url);
      const list = map.get(key) ?? [];
      list.push(page);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Главная") return -1;
      if (b === "Главная") return 1;
      return a.localeCompare(b, "ru");
    });
  }, [job, search]);

  async function handleCancel() {
    if (!job || cancelling) return;
    setCancelling(true);
    try {
      await fetch(`/api/crawl/${job.id}?mode=cancel`, { method: "DELETE" });
    } finally {
      setCancelling(false);
    }
  }

  if (notFound) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">Обход не найден.</div>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-sm text-accent-warm/70 hover:text-accent-warm"
          >
            <ArrowLeft size={16} /> К дашборду
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
          <p className="flex items-center gap-2 text-accent-warm/60">
            <Loader2 size={18} className="animate-spin text-accent-warm/60" /> Загрузка…
          </p>
        </main>
        <Footer />
      </>
    );
  }

  const status = STATUS_LABELS[job.status] ?? STATUS_LABELS.queued;
  const isActive = job.status === "running" || job.status === "queued";
  const progress = Math.min(100, Math.round((job.pagesDone / Math.max(1, job.maxPages)) * 100));

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-accent-warm/70 hover:text-accent-warm"
          >
            <ArrowLeft size={16} /> Дашборд
          </Link>
          {job.companyId && (
            <Link
              href={`/company/${job.companyId}`}
              className="inline-flex items-center gap-1.5 text-sm text-accent-warm/70 hover:text-accent-warm"
            >
              {job.companyName || "Карточка компании"}
            </Link>
          )}
        </div>

        {/* Header card: site, status, stats, downloads */}
        <div className="mt-4 rounded-3xl border border-accent-warm/10 bg-white/60 p-5 shadow-lg shadow-accent-warm/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-xl font-semibold tracking-tight">{job.startUrl}</h1>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-accent-warm/60">
                Спаршено {job.pagesDone} стр.
                {job.pagesFailed > 0 && ` · пропущено ${job.pagesFailed}`}
                {` · лимит ${job.maxPages} · глубина ${job.maxDepth}`}
                {isActive && " — идёт обход, список пополняется"}
              </p>
              {job.error && <p className="mt-1 text-sm text-red-700">{job.error}</p>}
              {isActive && (
                <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-accent-warm/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-gold to-accent-gold-bright transition-all duration-500"
                    style={{ width: `${Math.max(4, progress)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/crawl/${job.id}/export?format=zip`}
                className="flex items-center gap-2 rounded-xl bg-accent-warm/10 px-3 py-2 text-sm text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
              >
                <FileArchive size={15} /> ZIP
              </a>
              <a
                href={`/api/crawl/${job.id}/export?format=md`}
                className="flex items-center gap-2 rounded-xl bg-accent-warm/10 px-3 py-2 text-sm text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
              >
                <FileText size={15} /> Общий .md
              </a>
              {isActive && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 transition-all duration-300 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <OctagonX size={15} />
                  )}
                  Остановить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Viewer: sidebar + rendered markdown */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:h-[70vh] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex max-h-[50vh] flex-col rounded-3xl border border-accent-warm/10 bg-white/40 p-4 shadow-lg shadow-accent-warm/5 lg:max-h-none lg:min-h-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-warm/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по страницам…"
                className="w-full rounded-xl border border-accent-warm/15 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-all duration-300 focus:border-accent-gold"
              />
            </div>
            <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {groups.length === 0 && (
                <p className="px-1 text-sm text-accent-warm/50">
                  {job.pages.length === 0
                    ? isActive
                      ? "Страницы появятся здесь через несколько секунд…"
                      : "Ни одной страницы не спаршено."
                    : "Ничего не найдено."}
                </p>
              )}
              {groups.map(([section, pages]) => (
                <div key={section}>
                  <p className="px-1 text-xs font-semibold uppercase tracking-wide text-accent-warm/40">
                    {section} · {pages.length}
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {pages.map((page) => (
                      <li key={page.id}>
                        <button
                          onClick={() => setSelectedId(page.id)}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-all duration-300 ${
                            selectedId === page.id
                              ? "border border-accent-gold/40 bg-accent-gold/10 text-accent-warm"
                              : "border border-transparent text-accent-warm/80 hover:border-accent-warm/10 hover:bg-white/60"
                          }`}
                        >
                          <span className="block truncate font-medium">
                            {page.title || page.url}
                          </span>
                          <span className="block truncate text-xs text-accent-warm/40">
                            {page.url}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          <section className="flex max-h-[70vh] flex-col rounded-3xl border border-accent-warm/10 bg-white/60 p-5 shadow-lg shadow-accent-warm/5 lg:max-h-none lg:min-h-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-accent-warm/10 pb-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-accent-warm">
                  {pageContent?.title || "Выберите страницу"}
                </h2>
                {pageContent && (
                  <a
                    href={pageContent.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-accent-warm/50 underline hover:text-accent-warm"
                  >
                    {pageContent.url}
                  </a>
                )}
              </div>
              {selectedId && (
                <a
                  href={`/api/crawl/${job.id}/pages/${selectedId}?download=1`}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-accent-warm/10 px-3 py-2 text-sm text-accent-warm transition-all duration-300 hover:bg-accent-warm/20"
                >
                  <Download size={15} /> Скачать .md
                </a>
              )}
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
              {loadingPage ? (
                <p className="flex items-center gap-2 text-sm text-accent-warm/60">
                  <Loader2 size={16} className="animate-spin text-accent-warm/60" /> Загрузка
                  страницы…
                </p>
              ) : pageContent ? (
                <MarkdownView content={pageContent.markdown} />
              ) : (
                <p className="text-sm text-accent-warm/50">
                  Выберите страницу слева, чтобы просмотреть её содержимое.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
