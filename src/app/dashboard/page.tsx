"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, ExternalLink, Search, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

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

export default function DashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/analyses");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of saved analyses on mount
    load();
  }, []);

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/analyses/${id}`, { method: "DELETE" });
  }

  const filtered = useMemo(
    () => items.filter((i) => i.companyName.toLowerCase().includes(query.toLowerCase())),
    [items, query]
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
          <h1 className="text-3xl font-semibold tracking-tight">Дашборд анализов</h1>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-2xl bg-accent-warm px-4 py-2.5 text-sm font-medium text-accent-gold-bright shadow-lg shadow-accent-warm/20 transition-all duration-300 hover:bg-accent-warm/90"
          >
            <Plus size={18} /> Новый анализ
          </Link>
        </div>

        <div className="relative mt-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-warm/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию компании"
            className="w-full rounded-2xl border border-accent-warm/15 bg-white py-3 pl-11 pr-4 text-base outline-none transition-all duration-300 focus:border-accent-gold"
          />
        </div>

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
      </main>
      <Footer />
    </>
  );
}
