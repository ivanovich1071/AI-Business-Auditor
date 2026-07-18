const STAGES = ["Парсинг сайта", "Сбор данных (MCP)", "Анализ отрасли", "Подбор AI-агентов"];

export function ProgressBar({ stage }: { stage: number }) {
  return (
    <div className="w-full">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-accent-warm/10">
        <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-accent-gold to-accent-gold-bright animate-progress-indeterminate" />
      </div>
      <p className="mt-2 text-sm text-accent-warm/70 transition-all duration-300">
        {STAGES[Math.min(stage, STAGES.length - 1)]}…
      </p>
    </div>
  );
}
