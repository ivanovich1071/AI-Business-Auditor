# AI Business Auditor

Бесплатное веб-приложение: вводите **URL сайта** и/или **название компании** — сервис
анализирует бизнес, определяет отрасль и бизнес-процессы и предлагает **5–10 персонализированных
AI-агентов** для автоматизации, ранжированных по полезности с объяснением.

🌐 **Демо:** http://62.60.234.40 · 📦 **Репозиторий:** https://github.com/ivanovich1071/AI-Business-Auditor

---

## Возможности

- **Анализ по URL или по названию** — если URL не задан, сайт компании ищется веб-поиском (DuckDuckGo).
- **Аудит бизнес-процессов** — отрасль, уверенность, список процессов с привязкой к отделам.
- **Подразделения/отделы** — определяются ИИ из анализа; выпадающий список фильтрует процессы и агентов.
- **Детализация процесса по клику** — попап с описанием, задачами, ожидаемыми результатами и отделом.
- **Рекомендации AI-агентов** — 5–10 штук, ранжированы (1–10), с пользой и обоснованием.
- **Чат по результатам** — вопросы строго в рамках анализа; история в `localStorage` по компании.
- **Дашборд** — сохранённые анализы карточками, поиск, статистика по отраслям, детальная карточка.
- **Обработка ошибок** — недоступный сайт, битый TLS (http-fallback), лимиты, сбой ИИ — понятные сообщения на русском.

Интерфейс — одна широкая страница с результатом в **3 равные колонки**: аудит · агенты · чат.

---

## Технологии

| Слой | Технологии |
|---|---|
| Фронтенд + Бэкенд | Next.js 16 (App Router), React 19, TypeScript |
| Стили | Tailwind CSS v4 (палитра через `@theme` в `globals.css`), иконки `lucide-react` |
| БД | SQLite + Prisma ORM |
| AI-модель | Qwen через OpenRouter API |
| Парсинг сайтов | Cheerio (статические страницы) |
| Веб-поиск | DuckDuckGo (бесключевой) — `src/lib/mcp/websearch.ts` |

Палитра: фон `#FAF9F6`, текст `#2C1B18`, тёплый акцент `#3E2723`, золото `#D4AF37` / `#FFC107`. Шрифт — Manrope.

---

## Быстрый старт

Требуется Node.js 20+.

```bash
git clone https://github.com/ivanovich1071/AI-Business-Auditor.git
cd AI-Business-Auditor
npm install
cp .env.example .env          # затем впишите ключи (см. ниже)
npx prisma migrate dev        # создаёт SQLite-базу и применяет миграции
npm run dev                   # http://localhost:3000
```

- Главная — http://localhost:3000
- Дашборд — http://localhost:3000/dashboard

### Переменные окружения (`.env`)

```env
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY=sk-or-v1-...        # обязательно (OpenRouter)
OPENROUTER_MODEL=qwen/qwen3-235b-a22b-2507

# Опционально — включают доп. источники данных, если заданы:
SERPAPI_KEY=
OPENCORPORATES_API_KEY=
CLEARBIT_API_KEY=
HUNTER_API_KEY=
```

`.env` и `prisma/dev.db` — в `.gitignore` и в репозиторий не попадают.

---

## Как это работает (pipeline)

```
{url?, name?}
   └─ нет url → resolveCompanySite(name)  ← веб-поиск DuckDuckGo (websearch.ts)
   └─ crawlSite(url)                       ← Cheerio, до 8 страниц, игнор ошибок, http-fallback
   └─ gatherMcpData()                      ← DuckDuckGo (+ опциональные источники по ключу)
   └─ LLM Блок 1: industry, departments[], business_processes[{name,department}], pains
   └─ LLM Блок 2: 5–10 AI-агентов (ранжированы, с department)
   └─ эфемерный результат (в БД НЕ пишется)
«Сохранить в дашборд» → POST /api/analyses → Company + Analysis в SQLite
```

Детализация процесса и чат — отдельные вызовы ИИ по запросу пользователя. Все ответы ИИ — строго
JSON и валидируются Zod-схемами (`src/types/analysis.ts`).

### Основные эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/analyze` | Анализ по `{url?, name?}` → эфемерный результат |
| POST | `/api/analyses` | Сохранить результат в дашборд |
| GET | `/api/analyses`, `/api/analyses/{id}` | Список / карточка |
| DELETE | `/api/analyses/{id}` | Удалить |
| POST | `/api/process-detail` | Детализация бизнес-процесса |
| POST | `/api/chat` | Чат по контексту анализа |

---

## Структура проекта

```
AI-Business-Auditor/
├── .claude/skills/           # скиллы Claude Code: frontend, backend (паттерн подключения MCP)
├── .mcp.json                 # MCP ddg_search для Claude Code (dev-время)
├── docs/                     # TZ.md (ТЗ) + SYSTEM_PROMPT.md (системный промпт ИИ)
├── prisma/                   # schema.prisma + миграции (SQLite)
├── src/
│   ├── app/                  # page.tsx, dashboard, company/[id], api/**, layout, globals.css
│   ├── components/           # Header, Footer, ResultsGrid, CompanyAudit, AgentsList,
│   │                         #   AgentCard, ChatPanel, DepartmentSelect, ProcessDetailPopup, ProgressBar
│   ├── lib/                  # parser, openrouter, prisma, security, mcp/{websearch,duckduckgo,optional,index}
│   └── types/analysis.ts     # Zod-схемы + типы + нормализация старых записей
└── CLAUDE.md                 # архитектура и правила проекта для Claude Code
```

---

## Модель данных

- **Company** — `id, name, url, industry, description, mcpData, createdAt`
- **Analysis** — `id, companyId, agents, summary, businessProcesses ({name,department}[]), departments (string[]), pains, confidence, createdAt`

JSON хранится строками (в SQLite нет native Json). Старые записи (без `departments`, процессы как
`string[]`) нормализуются при чтении — `normalizeBusinessProcesses` / `normalizeAgents`.

---

## Проверка и сборка

```bash
npx tsc --noEmit    # типы
npm run lint        # eslint (включая react-hooks)
npm run build       # продакшн-сборка
```

---

## Деплой (VPS)

Прод развёрнут на Ubuntu-сервере под **pm2** за **nginx** (reverse proxy `80 → 3000`).

```bash
cd /opt/AI-Business-Auditor
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart ai-auditor
```

pm2 настроен на автозапуск при перезагрузке. Подробности — в `CLAUDE.md`.

---

## Безопасность и приватность

- API-ключи только в `.env` (не в репозитории).
- Проверка URL от SSRF/локальных адресов (`isUrlSafe`) перед краулингом.
- Rate limiting: 10 запросов/мин с одного IP на публичных POST-роутах.
- Личные данные пользователей не сохраняются; история чата — только в браузере (`localStorage`).

---

## Документация

- `CLAUDE.md` — архитектура, соглашения, правила для Claude Code.
- `docs/TZ.md` — техническое задание.
- `docs/SYSTEM_PROMPT.md` — системный промпт ИИ (блоки анализа, генерации агентов, чата).
- `.claude/skills/frontend/` и `.claude/skills/backend/` — скиллы по фронтенду и бэкенду (в т.ч. паттерн подключения MCP).
