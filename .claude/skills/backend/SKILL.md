---
name: backend
description: Бэкенд AI Business Auditor (Next.js API routes, Prisma/SQLite, OpenRouter) и — главное — ПАТТЕРН подключения MCP/внешних инструментов в код AI-ассистентов. Загружать при работе с src/app/api, src/lib, интеграциями, веб-поиском, MCP, а также когда нужно «подключить MCP» в бэкенд любого из моих AI-ассистентов.
---

# Backend — AI Business Auditor

Справочник по серверной части и правило подключения MCP/инструментов в AI-ассистентах.
Читать перед правкой `src/app/api/**`, `src/lib/**`, `prisma/**`, `.mcp.json`.

## Стек

| Технология | Роль |
|---|---|
| Next.js (App Router) | API routes `src/app/api/**/route.ts` |
| Prisma + SQLite | `prisma/schema.prisma`, `src/lib/prisma.ts` (singleton) |
| OpenRouter (Qwen) | `src/lib/openrouter.ts` — все вызовы LLM, ответы строго JSON + Zod |
| Zod | валидация JSON-ответов LLM в `src/types/analysis.ts` |

---

## ⭐ Паттерн подключения MCP в AI-ассистентах (ГЛАВНОЕ)

**Проблема.** MCP-серверы в `.mcp.json` / `.claude/settings.local.json` (например `@oevortex/ddg_search`,
google-maps, openstreetmap) — это инструменты **для Claude Code / агент-хоста**. Они запускаются как
локальные `npx`-процессы на машине разработчика. **Задеплоенное приложение (Next.js на VPS) до них
НЕ достучится** — в проде этих процессов нет.

**Правило (два слоя, всегда разделять):**

1. **Рантайм (то, что реально работает в проде)** — пишем **прямой модуль** в `src/lib/mcp/<источник>.ts`,
   который сам ходит в тот же публичный API/эндпоинт, что оборачивает MCP-сервер. Никаких MCP-процессов
   в рантайме. Модуль **fault-tolerant**: при ошибке/лимите возвращает `null`/`[]`, а не падает.
2. **Claude Code (агент, dev-время)** — тот же MCP прописываем в **`.mcp.json`** (проектный scope),
   чтобы им пользовался Я (Claude Code) при разработке. Это НЕ канал для приложения.

> Проект и так называет свои интеграции «MCP-источниками» (папка `src/lib/mcp/`). Новый источник
> добавляем туда же и подключаем через агрегатор `src/lib/mcp/index.ts`.

### Эталон в этом проекте
- Рантайм-веб-поиск: [`src/lib/mcp/websearch.ts`](../../../src/lib/mcp/websearch.ts) — бесключевой DuckDuckGo
  (тот же источник, что оборачивает `@oevortex/ddg_search`). Используется в `/api/analyze` для поиска
  сайта по названию компании (`resolveCompanySite`).
- Регистрация MCP для Claude Code: [`.mcp.json`](../../../.mcp.json) → `ddg-search`.
- Опциональные источники по ключу из `.env`: [`src/lib/mcp/optional.ts`](../../../src/lib/mcp/optional.ts)
  (SerpAPI/OpenCorporates/Clearbit/Hunter.io) — без ключа модуль тихо пропускается.

### Как добавить новый MCP-источник (чек-лист)
1. `src/lib/mcp/<name>.ts` — экспортирует async-функцию, возвращает нормализованный результат или `null`.
   - `AbortController` + timeout (5–8 c). Свой `User-Agent`. Никогда не бросать наружу — `try/catch → null`.
   - Секреты только из `process.env.*`; нет ключа → модуль пропускается (не ошибка).
2. Подключить в `src/lib/mcp/index.ts` (`Promise.all`, собрать warnings, не ронять пайплайн).
3. Прописать сам MCP в `.mcp.json` для Claude Code (dev-время).
4. Задокументировать источник в `CLAUDE.md` (таблица «MCP / внешние данные»).

### Шаблон рантайм-модуля
```ts
// src/lib/mcp/<name>.ts
const UA = "Mozilla/5.0 …";
export async function fetchX(query: string): Promise<XResult | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 6000);
  try {
    const key = process.env.X_API_KEY;         // если источник по ключу
    if (!key) return null;                       // нет ключа → тихо пропускаем
    const res = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return normalize(await res.json());
  } catch {
    return null;                                 // fault-tolerant
  } finally {
    clearTimeout(t);
  }
}
```

### Гочи DuckDuckGo (проверено)
- `POST https://lite.duckduckgo.com/lite/` → **202 anomaly** (бот-гейт). Использовать **`GET`**:
  `GET https://lite.duckduckgo.com/lite/?q=…`, парсить ссылки с `uddg=<url>`.
- Для известных сущностей — Instant Answer API: `api.duckduckgo.com/?q=…&format=json` → `Results[0].FirstURL`.
- DDG режет частые запросы рейт-лимитом → если сайт не нашёлся, отдаём пользователю просьбу ввести URL
  (в `/api/analyze` это `404` с понятным сообщением), а не 500.

---

## LLM-вызовы (`src/lib/openrouter.ts`)
- Всё через `callOpenRouter()`: `response_format: json_object`, `X-Title`, timeout 60 c, ошибка → `OpenRouterError`.
- Каждый ответ парсится Zod-схемой из `src/types/analysis.ts`. Никогда не доверять сырому JSON от модели.
- Старые записи БД нормализуются на чтении: `normalizeBusinessProcesses` / `normalizeAgents`.
- Системный промпт запрещает выдумывать данные — если для источника нужен веб-поиск, он идёт через
  MCP-слой выше, а не через «знания модели».

## API routes (соглашения)
- Rate-limit + `getClientIp` из `src/lib/security.ts` на публичных POST (`/api/analyze`, `/api/chat`, `/api/process-detail`).
- `isUrlSafe` (SSRF-фильтр) перед краулингом любого URL.
- `/api/analyze` — эфемерный результат (в БД НЕ пишет). Сохранение только `POST /api/analyses`.
- Ошибки — понятные русские сообщения + корректный статус (400/404/429/502), тело `{ error }`.

## Prisma / БД
- Изменил `schema.prisma` → миграция: `npx prisma migrate dev --name <name>` (dev), в CI/проде `migrate deploy`.
- JSON хранится строкой (SQLite без native Json): `agents`, `businessProcesses`, `departments`, `pains`.
- Новые колонки — только аддитивно + нормализация старых записей на чтении.

## Проверка перед деплоем
`npx tsc --noEmit` и `npm run lint` — чисто. Прод: `npm run build`. Деплой на VPS 62.60.234.40 —
см. `CLAUDE.md` (git pull → npm ci → prisma migrate deploy → build → `pm2 restart ai-auditor`).
