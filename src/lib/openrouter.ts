import type { McpData } from "@/types/analysis";
import {
  AgentsResponseSchema,
  ChatAnswerSchema,
  IndustryAnalysisSchema,
  ProcessDetailSchema,
  normalizeBusinessProcesses,
  type AgentsResponse,
  type ChatAnswer,
  type IndustryAnalysis,
  type ProcessDetail,
} from "@/types/analysis";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT_BASE = `Ты — AI-аудитор, специализирующийся на анализе бизнеса и подборе AI-решений.
Работаешь только с данными из текста сайта компании и MCP-источников. Не придумывай данные —
используй только то, что есть в тексте сайта или MCP-ответах. Все ответы — на русском языке.
Формат вывода — строго JSON, без markdown-обрамления, без пояснений вне JSON.

Запреты: не придумывай отрасль/бизнес-процессы/агентов, если их нет в данных; не выходи за
пределы тематики анализа сайта и подбора AI-агентов; не используй личные/конфиденциальные данные;
не обещай конкретные проценты эффективности ("сократит затраты на 50%") — используй общие
формулировки ("повысит эффективность", "сократит время на процесс"); не предлагай агенты, не
связанные с бизнес-процессами компании.`;

class OpenRouterError extends Error {}

async function callOpenRouter(userContent: string, temperature = 0.3): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "qwen/qwen3-235b-a22b-2507";
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY не задан в .env");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "AI Business Auditor",
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT_BASE },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      throw new OpenRouterError(`OpenRouter вернул ${res.status}`);
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new OpenRouterError("Пустой ответ от модели");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

export async function analyzeIndustry(params: {
  url: string;
  siteText: string;
  mcpData: McpData;
}): Promise<IndustryAnalysis> {
  const prompt = `Проанализируй текст сайта и данные MCP. Определи:
1. industry — отрасль компании.
2. departments — список из 3–7 подразделений/отделов компании (например: «Продажи», «Производство»,
   «Логистика», «Маркетинг», «HR», «Клиентская поддержка», «Бухгалтерия», «IT»). Опирайся на то, что
   реально следует из текста и отрасли; не выдумывай отделы, которых заведомо не может быть.
3. business_processes — ключевые бизнес-процессы. Каждый процесс — объект {name, department}, где
   department — один из перечисленных выше отделов, к которому этот процесс относится (или null).
4. pains — основные боли/проблемы, которые видны из данных.
5. confidence — уверенность 0..1. sources — на что опирался вывод.

Ответь ТОЛЬКО в формате JSON со схемой:
{"industry": string|null, "departments": string[],
 "business_processes": [{"name": string, "department": string|null}],
 "pains": string[], "confidence": number, "sources": string[], "message"?: string}

Данные:
${JSON.stringify({ url: params.url, site_text: params.siteText, mcp_data: params.mcpData }, null, 2)}`;

  try {
    const raw = await callOpenRouter(prompt, 0.2);
    const obj = extractJson(raw) as Record<string, unknown>;
    // Normalize business_processes so string[] responses still validate.
    if (obj && typeof obj === "object") {
      obj.business_processes = normalizeBusinessProcesses(obj.business_processes);
      if (!Array.isArray(obj.departments)) obj.departments = [];
    }
    return IndustryAnalysisSchema.parse(obj);
  } catch (err) {
    return IndustryAnalysisSchema.parse({
      industry: null,
      departments: [],
      business_processes: [],
      pains: [],
      confidence: null,
      sources: [],
      message:
        err instanceof OpenRouterError
          ? "Извините, произошла ошибка при обращении к AI-модели. Попробуйте ещё раз."
          : "Не удалось определить отрасль. Уточните её вручную для более точного анализа.",
    });
  }
}

export async function generateAgents(params: {
  companyName: string;
  industry: string;
  departments: string[];
  businessProcesses: { name: string; department: string | null }[];
  pains: string[];
}): Promise<AgentsResponse> {
  const prompt = `На основе отрасли '${params.industry}', отделов ${JSON.stringify(
    params.departments
  )} и бизнес-процессов ${JSON.stringify(params.businessProcesses)} (боли: ${JSON.stringify(
    params.pains
  )}) предложи 5–10 AI-агентов для компании '${params.companyName}'. Для каждого агента укажи:
name (на русском), description (что делает), benefits (string[], польза для компании),
why (почему подходит именно этой компании), priority (1-10, где 10 — максимально полезный),
department (к какому из перечисленных отделов относится агент, или null). Ответь ТОЛЬКО в формате JSON:
{"agents": [{"name": string, "description": string, "benefits": string[], "why": string, "priority": number, "department": string|null}],
 "summary": string}`;

  const raw = await callOpenRouter(prompt, 0.4);
  return AgentsResponseSchema.parse(extractJson(raw));
}

export async function generateProcessDetail(params: {
  companyName: string;
  industry: string | null;
  process: string;
  departments: string[];
}): Promise<ProcessDetail> {
  const prompt = `Детализируй бизнес-процесс "${params.process}" компании '${params.companyName}'
(отрасль: ${params.industry ?? "не определена"}). Укажи:
description — краткое описание процесса;
tasks — конкретные задачи внутри процесса (string[]);
results — ожидаемые результаты процесса (string[]);
department — ответственный отдел из списка ${JSON.stringify(params.departments)} (или null).
Не обещай конкретных процентов. Ответь ТОЛЬКО в формате JSON:
{"description": string, "tasks": string[], "results": string[], "department": string|null}`;

  const raw = await callOpenRouter(prompt, 0.3);
  return ProcessDetailSchema.parse(extractJson(raw));
}

export async function answerChatQuestion(params: {
  question: string;
  context: {
    companyName: string;
    industry: string | null;
    businessProcesses: string[];
    agents: { name: string; priority: number }[];
  };
}): Promise<ChatAnswer> {
  const prompt = `Ответь на вопрос пользователя, используя ТОЛЬКО контекст анализа ниже. Если вопрос
не связан с анализом сайта, отраслью, бизнес-процессами или предложенными AI-агентами, ответь ровно:
"Извините, я могу отвечать только на вопросы, связанные с анализом сайта и подбором AI-агентов."
Ответь ТОЛЬКО в формате JSON: {"answer": string}

Вопрос: "${params.question}"
Контекст анализа: ${JSON.stringify(params.context)}`;

  try {
    const raw = await callOpenRouter(prompt, 0.3);
    return ChatAnswerSchema.parse(extractJson(raw));
  } catch {
    return { answer: "Извините, произошла ошибка. Попробуйте ещё раз." };
  }
}
