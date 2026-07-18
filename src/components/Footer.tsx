import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-accent-warm/10 mt-auto">
      <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between text-sm text-accent-warm/60">
        <Link href="/dashboard" className="hover:text-accent-warm transition-all duration-300">
          Все анализы →
        </Link>
        <span>© 2026 AI Business Auditor</span>
      </div>
    </footer>
  );
}
