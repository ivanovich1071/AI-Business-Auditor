import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-accent-warm/10 bg-background/80 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-warm text-accent-gold-bright transition-all duration-300 group-hover:scale-105">
            <Sparkles size={18} />
          </span>
          <span className="text-2xl font-semibold tracking-tight">AI Business Auditor</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-accent-warm/70 hover:text-accent-warm transition-all duration-300"
        >
          Дашборд
        </Link>
      </div>
    </header>
  );
}
