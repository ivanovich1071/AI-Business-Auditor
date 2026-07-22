---
name: frontend
description: Настройки и соглашения фронтенда AI Business Auditor — Next.js 16 App Router, React 19, Tailwind v4 (палитра через @theme в globals.css), lucide-react иконки, локальный стейт + session/localStorage, 3-колоночная сетка результатов. Загружать при любой работе с src/app, src/components, стилями или клиентским UI этого проекта.
---

# Frontend — AI Business Auditor

Справочник по фронтенд-части проекта: стек, палитра, структура, соглашения. Читать перед
любой правкой `src/app/**`, `src/components/**`, `src/app/globals.css`, `src/app/layout.tsx`.

## Стек

| Технология | Версия | Роль |
|---|---|---|
| Next.js | 16.2 (App Router, Turbopack) | Роутинг, RSC, API routes (`route.ts`) |
| React | 19.2 | UI |
| TypeScript | 5.x | strict (`tsconfig.json`), алиас `@/*` → `src/*` |
| Tailwind CSS | **v4** | Вся стилизация. **Конфиг через `@theme` в `globals.css`, файла `tailwind.config.*` НЕТ** |
| lucide-react | 1.x | Иконки (НЕ inline SVG — в отличие от других проектов) |
| Zod | 4.x | Схемы JSON-контрактов с LLM (`src/types/analysis.ts`), используется и на бэке |

Dev-сервер: `npm run dev` → **порт 3000**. Прод: `npm run build && npm run start`.
Стейт — **локальный React `useState` + `sessionStorage`/`localStorage`**. Zustand/Redux НЕ используются.

## Маршруты

| Маршрут | Файл | Тип |
|---|---|---|
| `/` | `src/app/page.tsx` | `"use client"` — ввод URL/названия, 3-колоночный результат, «Сохранить» |
| `/dashboard` | `src/app/dashboard/page.tsx` | `"use client"` — карточки-кнопки анализов + «Новый анализ» |
| `/company/[id]` | `src/app/company/[id]/page.tsx` | `"use client"` — детальная карточка (`useParams`), стрелка «Назад» |
| — | `src/app/layout.tsx` | Root layout: `<html lang="ru">`, шрифт Manrope, импорт `globals.css` |

Все страницы — `"use client"` (стейт/эффекты/`useParams`/`useRouter`). RSC-страниц пока нет.

## Цветовая палитра (фирменный стиль)

Определена в `src/app/globals.css` через `@theme inline` (Tailwind v4) как CSS-переменные,
используется **только через Tailwind-классы** (`bg-accent-warm`, `text-accent-gold` …) —
хардкодить hex в JSX не нужно.

```css
--background: #FAF9F6;          /* фон страниц      → bg-background */
--foreground: #2C1B18;          /* основной текст   → text-foreground */
--accent-warm: #3E2723;         /* тёплый акцент    → bg/text-accent-warm */
--accent-gold: #D4AF37;         /* золото           → accent-gold */
--accent-gold-bright: #FFC107;  /* яркое золото/CTA → accent-gold-bright */
```

Соглашения: `rounded-2xl`/`rounded-3xl` для карточек и кнопок; `shadow-lg shadow-accent-warm/5`
— мягкая тёплая тень; переходы `transition-all duration-300`; полупрозрачности через `/NN`
(`border-accent-warm/10`, `text-accent-warm/60`). Кастомная анимация `.animate-progress-indeterminate`
(прогресс-бар) — в `globals.css`. Шрифт — **Manrope** через `next/font` (`--font-manrope`,
subsets `latin` + `cyrillic`), подключён в `layout.tsx`; Google Fonts вручную не тянуть.

## Структура компонентов

```
src/
├── app/
│   ├── page.tsx                 # главная: 2 инпута (URL+название) → ResultsGrid + «Сохранить»
│   ├── dashboard/page.tsx       # список анализов (карточки-кнопки), «Новый анализ»
│   ├── company/[id]/page.tsx    # детальная карточка (fetch /api/analyses/[id]) + «Назад»
│   ├── layout.tsx               # root layout, Manrope
│   ├── globals.css              # Tailwind v4 + @theme (палитра) + keyframes
│   └── api/**/route.ts          # серверные роуты — см. скилл `backend`, не фронтенд
├── components/
│   ├── Header.tsx / Footer.tsx  # общий каркас (логотип, ссылка на дашборд, копирайт)
│   ├── ProgressBar.tsx          # индикатор этапов анализа (stage 0..3)
│   ├── ResultsGrid.tsx          # ⭐ 3 равные колонки; держит общий стейт `department`
│   ├── CompanyAudit.tsx         # колонка 1: отрасль/уверенность + DepartmentSelect + плашки БП
│   ├── AgentsList.tsx           # колонка 2: агенты со скроллом (фильтр по отделу)
│   ├── AgentCard.tsx            # карточка одного агента (приоритет, benefits, why, отдел)
│   ├── ChatPanel.tsx            # колонка 3: чат, история в localStorage по компании
│   ├── DepartmentSelect.tsx     # выпадающий список отделов
│   └── ProcessDetailPopup.tsx   # модалка детализации БП (fetch /api/process-detail)
└── types/analysis.ts            # Zod-схемы + типы + normalize* (общие с бэком)
```

## Ключевая раскладка результата (`ResultsGrid.tsx`)

3 равные колонки: `grid grid-cols-1 gap-5 lg:grid-cols-3 lg:[height:70vh]`. На мобильных —
стек. `ResultsGrid` владеет общим стейтом `department` (выбор в `CompanyAudit` фильтрует
и процессы в колонке 1, и агентов в колонке 2). Одна и та же сетка используется и на `/`,
и на `/company/[id]` — при изменениях правь `ResultsGrid`, а не дублируй.

## Стейт и хранение

- **Главная** (`page.tsx`): результат анализа эфемерный (в БД не пишется до «Сохранить»),
  кэшируется в `sessionStorage["aiba:lastResult"]` (переживает перезагрузку вкладки).
- **Чат** (`ChatPanel.tsx`): история в `localStorage["aiba:chat:<companyId|url>"]` — не теряется
  после закрытия вкладки, привязана к компании.
- **Фильтр отдела**: локальный `useState` в `ResultsGrid`, не персистится.
- Новое клиентское состояние — держи в компоненте/`ResultsGrid`; отдельных сторов не заводить.

## Соглашения по стилю кода

- **Иконки** — `lucide-react` (`import { Search, Save, … } from "lucide-react"`), размер `size={…}`.
  Inline SVG не добавлять (в этом проекте иконочная либа есть — в отличие от продажника).
- **Загрузка** — `Loader2` c `animate-spin`, либо `ProgressBar` для пайплайна анализа. Skeleton-либы не нужны.
- **Ошибки пользователю** — дружелюбный русский текст в `bg-red-50 text-red-700` блоке; warnings — в
  `bg-accent-gold/10`. Никогда не показывать raw error/stack.
- **Гидрация из storage в эффекте** — линтер ругается `react-hooks/set-state-in-effect`; на разовый
  `setState` в mount-эффекте ставь `// eslint-disable-next-line react-hooks/set-state-in-effect` с
  пояснением (см. `page.tsx`, `ChatPanel.tsx`, `dashboard/page.tsx`).
- **Внешние ссылки на сайты** — нормализуй схему: `href={/^https?:\/\//i.test(url) ? url : \`https://${url}\`}`
  (URL может прийти без `https://`), `target="_blank" rel="noopener noreferrer"`.
- **Кликабельная карточка** (дашборд) — `role="button" tabIndex={0} onClick/onKeyDown`, а вложенные
  кнопки/ссылки гасят всплытие `e.stopPropagation()`.
- **Компоненты «толстые»** — вся логика колонки в одном файле; общих UI-примитивов (Button/Input) нет,
  дублирование Tailwind-классов дешевле абстракции. Не выделять примитивы без явного запроса.

## Проверка перед коммитом

```bash
npx tsc --noEmit    # обязательно после любой правки .ts/.tsx
npm run lint        # eslint (в т.ч. react-hooks) — держать чистым
npm run dev         # ручная проверка в браузере — порт 3000
```

Верификация в браузере — через Browser-pane (`preview_start` на `http://localhost:3000`).
Долгие вызовы LLM (`/api/analyze` ~30–40 c, `/api/process-detail` ~15–20 c) — при проверке
не спеши, дожидайся ответа; статусы смотри в логе dev-сервера.
