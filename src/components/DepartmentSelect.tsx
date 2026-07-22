"use client";

import { ChevronDown } from "lucide-react";

export function DepartmentSelect({
  departments,
  value,
  onChange,
}: {
  departments: string[];
  value: string | null;
  onChange: (dept: string | null) => void;
}) {
  if (departments.length === 0) return null;
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full appearance-none rounded-xl border border-accent-warm/15 bg-white py-2 pl-3 pr-9 text-sm outline-none transition-all duration-300 focus:border-accent-gold"
      >
        <option value="">Все подразделения</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-accent-warm/40"
      />
    </div>
  );
}
