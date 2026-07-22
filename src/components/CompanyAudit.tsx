"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Building2 } from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";
import { DepartmentSelect } from "./DepartmentSelect";
import { ProcessDetailPopup } from "./ProcessDetailPopup";

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function CompanyAudit({
  result,
  department,
  onDepartmentChange,
}: {
  result: AnalysisResult;
  department: string | null;
  onDepartmentChange: (dept: string | null) => void;
}) {
  const [openProcess, setOpenProcess] = useState<string | null>(null);

  const processes = useMemo(() => {
    if (!department) return result.businessProcesses;
    return result.businessProcesses.filter((p) => p.department === department);
  }, [result.businessProcesses, department]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-accent-warm/10 bg-white/40 p-5 shadow-lg shadow-accent-warm/5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-warm text-accent-gold-bright">
          <Building2 size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{result.companyName}</h2>
          <a
            href={withScheme(result.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm text-accent-warm/60 hover:underline"
          >
            {result.url}
          </a>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {result.industry && (
          <span className="rounded-full bg-accent-gold/15 px-3 py-1 text-sm font-medium text-accent-warm">
            Отрасль: {result.industry}
          </span>
        )}
        {result.confidence != null && (
          <span className="rounded-full bg-accent-warm/10 px-3 py-1 text-sm text-accent-warm/70">
            Уверенность: {Math.round(result.confidence * 100)}%
          </span>
        )}
      </div>

      {result.departments.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-accent-warm/60">Подразделение / отдел</p>
          <DepartmentSelect
            departments={result.departments}
            value={department}
            onChange={onDepartmentChange}
          />
        </div>
      )}

      <p className="mt-4 text-sm font-semibold text-accent-warm">Бизнес-процессы</p>
      <p className="text-xs text-accent-warm/50">Нажмите на процесс — покажем задачи и результаты</p>
      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {processes.length === 0 && (
          <p className="text-sm text-accent-warm/50">Для выбранного отдела процессы не найдены.</p>
        )}
        {processes.map((p, i) => (
          <button
            key={p.name + i}
            onClick={() => setOpenProcess(p.name)}
            className="w-full rounded-xl border border-accent-warm/10 bg-white/60 px-3 py-2 text-left text-sm transition-all duration-300 hover:border-accent-gold hover:bg-accent-gold/5"
          >
            <span className="font-medium text-foreground/85">{p.name}</span>
            {p.department && (
              <span className="ml-2 text-xs text-accent-warm/50">· {p.department}</span>
            )}
          </button>
        ))}
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl bg-accent-gold/10 p-2.5 text-xs text-accent-warm"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {openProcess && (
        <ProcessDetailPopup
          process={openProcess}
          companyName={result.companyName}
          industry={result.industry}
          departments={result.departments}
          onClose={() => setOpenProcess(null)}
        />
      )}
    </div>
  );
}
