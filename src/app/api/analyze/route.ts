import { NextRequest, NextResponse } from "next/server";
import { crawlSite, SiteUnavailableError } from "@/lib/parser";
import { gatherMcpData } from "@/lib/mcp";
import { resolveCompanySite } from "@/lib/mcp/websearch";
import { analyzeIndustry, generateAgents } from "@/lib/openrouter";
import { checkRateLimit, getClientIp, isUrlSafe } from "@/lib/security";
import type { AnalysisResult } from "@/types/analysis";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через минуту." },
      { status: 429 }
    );
  }

  let body: { url?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  let url = body.url?.trim() || "";
  const name = body.name?.trim() || "";

  if (!url && !name) {
    return NextResponse.json({ error: "Укажите URL сайта или название компании." }, { status: 400 });
  }

  const warnings: string[] = [];

  // Resolve a site from the company name when no URL was provided.
  if (!url && name) {
    const resolved = await resolveCompanySite(name);
    if (!resolved) {
      return NextResponse.json(
        {
          error: `Не удалось найти сайт компании «${name}». Укажите URL сайта вручную.`,
        },
        { status: 404 }
      );
    }
    url = resolved;
    warnings.push(`Сайт найден по названию через веб-поиск: ${url}`);
  }

  if (!isUrlSafe(url)) {
    return NextResponse.json(
      { error: "Этот адрес не может быть проанализирован. Проверьте URL." },
      { status: 400 }
    );
  }

  let crawl;
  try {
    crawl = await crawlSite(url);
  } catch (err) {
    if (err instanceof SiteUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Сайт недоступен. Проверьте URL или попробуйте позже." },
      { status: 502 }
    );
  }

  if (!crawl.siteText || crawl.siteText.length < 20) {
    return NextResponse.json(
      { error: "Не удалось извлечь текст сайта. Проверьте URL или попробуйте позже." },
      { status: 502 }
    );
  }

  const mcpData = await gatherMcpData(name || crawl.companyNameGuess, url);

  const industryAnalysis = await analyzeIndustry({ url, siteText: crawl.siteText, mcpData });

  warnings.push(...mcpData.warnings);
  if (crawl.pagesSkipped.length > 0) {
    warnings.push(
      `Не удалось проанализировать ${crawl.pagesSkipped.length} страниц(-у). Продолжаем анализ без них.`
    );
  }

  const companyName =
    name ||
    mcpData.company_name ||
    crawl.companyNameGuess ||
    new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;

  if (!industryAnalysis.industry) {
    return NextResponse.json({
      industry: null,
      message:
        industryAnalysis.message ??
        "Не удалось определить отрасль. Уточните её вручную для более точного анализа.",
      companyName,
      warnings,
    });
  }

  let agentsResponse;
  try {
    agentsResponse = await generateAgents({
      companyName,
      industry: industryAnalysis.industry,
      departments: industryAnalysis.departments,
      businessProcesses: industryAnalysis.business_processes,
      pains: industryAnalysis.pains,
    });
  } catch {
    return NextResponse.json(
      { error: "Извините, произошла ошибка. Попробуйте ещё раз." },
      { status: 502 }
    );
  }

  // Ephemeral result — persisted only when the user clicks "Save to dashboard".
  const result: AnalysisResult = {
    id: null,
    companyId: null,
    companyName,
    url,
    industry: industryAnalysis.industry,
    description: industryAnalysis.sources.join(" "),
    businessProcesses: industryAnalysis.business_processes,
    departments: industryAnalysis.departments,
    pains: industryAnalysis.pains,
    confidence: industryAnalysis.confidence,
    agents: agentsResponse.agents,
    summary: agentsResponse.summary,
    createdAt: new Date().toISOString(),
    warnings,
    saved: false,
  };

  return NextResponse.json(result);
}
