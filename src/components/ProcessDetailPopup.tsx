"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { ProcessDetail } from "@/types/analysis";

export function ProcessDetailPopup({
  process,
  companyName,
  industry,
  departments,
  onClose,
}: {
  process: string;
  companyName: string;
  industry: string | null;
  departments: string[];
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/process-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ process, companyName, industry, departments }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Не удалось получить детализацию.");
        else setDetail(data as ProcessDetail);
      } catch {
        if (!cancelled) setError("Не удалось получить детализацию процесса. Попробуйте ещё раз.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [process, companyName, industry, departments]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-semibold">{process}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent-warm/60 transition-all duration-300 hover:bg-accent-warm/10"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-accent-warm/60">
            <Loader2 size={18} className="animate-spin" />
            Детализируем процесс…
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {detail && (
          <div className="mt-4 space-y-4">
            {detail.department && (
              <span className="inline-block rounded-full bg-accent-gold/15 px-3 py-1 text-sm font-medium text-accent-warm">
                Отдел: {detail.department}
              </span>
            )}
            <p className="text-sm leading-relaxed text-foreground/85">{detail.description}</p>

            {detail.tasks.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-accent-warm">Задачи</p>
                <ul className="mt-1 space-y-1">
                  {detail.tasks.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/75">
                      <span className="text-accent-gold">•</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.results.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-accent-warm">Ожидаемые результаты</p>
                <ul className="mt-1 space-y-1">
                  {detail.results.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/75">
                      <span className="text-accent-gold">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
