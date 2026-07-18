# CLAUDE.md — AI Business Auditor

Справочный файл для Claude Code. Описывает архитектуру и состояние проекта.

---

## 1. Назначение

**AI Business Auditor** — бесплатное веб-приложение: пользователь вводит URL сайта компании,
система анализирует контент, определяет отрасль и бизнес-процессы, и предлагает 5–10
персонализированных AI-агентов для автоматизации, ранжированных по полезности с объяснением.

Полное ТЗ и системный промпт для AI см. в [`docs/TZ.md`](docs/TZ.md) и [`docs/SYSTEM_PROMPT.md`](docs/SYSTEM_PROMPT.md).

---

## 2. Стек

| Слой | Технология |
|------|-----------|
| Frontend + Backend | Next.js 15 (App Router) + TypeScript, единый проект |
| Стили | Tailwind CSS v4 |
| БД | SQLite + Prisma ORM |
| Парсинг сайтов | Cheerio (статика). Puppeteer для SPA — не подключён, задел на будущее |
| AI-модель | Qwen (через OpenRouter API), ключ в `.env` (`OPENROUTER_API_KEY`) |
| MCP / внешние данные | DuckDuckGo Instant Answer API (бесплатно, без ключа) — единственный источник на старте.
SerpAPI / OpenCorporates / Clearbit / Hunter.io — опциональные модули, включаются, если в `.env` появится соответствующий ключ (`SERPAPI_KEY`, `OPENCORPORATES_API_KEY`, `CLEARBIT_API_KEY`, `HUNTER_API_KEY`); без ключа модуль пропускается без ошибки |

---

## 3. Структура каталогов

```
ai-business-auditor/
├── .claude/                    # Claude Code настройки (локальные, частично в git)
│   └── settings.local.json
├── docs/
│   ├── TZ.md                   # Полное техническое задание (эталон требований)
│   └── SYSTEM_PROMPT.md        # Системный промпт для AI (Qwen через OpenRouter)
├── prisma/
│   ├── schema.prisma
│   └── dev.db                  # SQLite (НЕ в git)
├── src/
│   ├── app/
│   │   ├── page.tsx            # Главная страница: URL-инпут, результаты, чат
│   │   ├── dashboard/page.tsx  # Дашборд сохранённых анализов
│   │   ├── api/
│   │   │   ├── analyze/route.ts    # POST — полный pipeline анализа
│   │   │   ├── chat/route.ts       # POST — чат, строго по контексту анализа
│   │   │   └── analyses/
│   │   │       ├── route.ts        # GET — список анализов
│   │   │       └── [id]/route.ts   # DELETE — удаление записи
│   │   └── globals.css
│   ├── components/             # UI-компоненты (карточки агентов, чат, прогресс-бар)
│   ├── lib/
│   │   ├── prisma.ts           # Singleton PrismaClient
│   │   ├── parser.ts           # Cheerio-краулер сайта (игнор 404/5xx, лимит страниц)
│   │   ├── openrouter.ts       # Клиент OpenRouter + системные промпты (analysis/agents/chat)
│   │   └── mcp/
│   │       ├── duckduckgo.ts   # Бесплатный источник данных о компании
│   │       └── index.ts        # Агрегатор MCP-источников, fault-tolerant
│   └── types/
│       └── analysis.ts         # Zod-схемы + TS-типы для JSON-контрактов с AI
├── .env                        # Ключи (НЕ в git)
├── .env.example
└── package.json
```

---

## 4. Архитектура pipeline

```
URL → parser.ts (crawl до N страниц, игнор ошибок)
    → mcp/index.ts (DuckDuckGo + опционально SerpAPI/OpenCorporates/Clearbit/Hunter.io)
    → openrouter.ts: Блок 1 — определение отрасли/бизнес-процессов/болей (JSON)
    → openrouter.ts: Блок 2 — генерация 5–10 AI-агентов, ранжированных (JSON)
    → Prisma: сохранение Company + Analysis
    → Frontend: рендер результатов, прогресс-бар на каждом шаге
```

Чат (`/api/chat`) использует Блок 3 системного промпта: контекст = сохранённый анализ,
тема строго ограничена (industry/business_processes/agents), офф-топик → отказ на русском.

---

## 5. Модель данных (Prisma)

- **Company** — `id, name, url, industry, description, mcpData (Json), createdAt`
- **Analysis** — `id, companyId → Company, agents (Json[]), summary, businessProcesses (Json), pains (Json), confidence, createdAt`

Агенты хранятся как JSON-массив внутри `Analysis.agents` (не отдельная таблица) — соответствует
формату ответа AI (Блок 2 системного промпта) и избавляет от лишней нормализации для MVP.

---

## 6. Переменные окружения (`.env`)

```env
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=qwen/qwen3-235b-a22b-2507
# Опционально — включают доп. MCP-источники, если заданы:
SERPAPI_KEY=
OPENCORPORATES_API_KEY=
CLEARBIT_API_KEY=
HUNTER_API_KEY=
```

---

## 7. Запуск

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

http://localhost:3000 — главная страница
http://localhost:3000/dashboard — дашборд анализов

---

## 8. Принципы AI-промпта

- Все ответы AI — строго JSON (см. `docs/SYSTEM_PROMPT.md`), валидируются Zod-схемами перед сохранением.
- AI не придумывает отрасль/агентов, если данных недостаточно — возвращает `industry: null` с пояснением.
- Чат ограничен темой текущего анализа; офф-топик получает фиксированный отказ на русском.
- Не обещаем конкретные проценты эффективности от лица AI, если их нет в источнике — используем
  общие формулировки ("повысит эффективность").
- Ключи MCP-сервисов хранятся только в `.env`, без ключа модуль тихо пропускается
  (`{"warning": "..."}"`, не `error`, если это не критично для анализа).

---

## 9. Дизайн (Tailwind, палитра)

| Роль | Цвет |
|------|------|
| Фон | `#FAF9F6` |
| Текст | `#2C1B18` |
| Акцент тёплый | `#3E2723` |
| Акцент золотой | `#D4AF37` / `#FFC107` |

Шрифт — Inter/Manrope, скругления `rounded-2xl`/`rounded-3xl`, переходы `transition-all duration-300`.
Одноколоночный layout: header → URL-инпут+прогресс → результаты (скролл) → чат → footer.

---

## 10. Статус

🔲 Проект в разработке — см. `TaskList` текущей сессии Claude Code за прогрессом реализации.
MVP-скоуп: анализ сайта (только текст, без Puppeteer/SPA), MCP = DuckDuckGo only,
дашборд с CRUD, чат без персистентной истории (только сессия).
