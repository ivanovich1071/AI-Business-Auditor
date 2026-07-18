import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crawlSite, SiteUnavailableError } from "@/lib/parser";
import { gatherMcpData } from "@/lib/mcp";
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

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Укажите URL сайта." }, { status: 400 });
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

  const mcpData = await gatherMcpData(crawl.companyNameGuess, url);

  const industryAnalysis = await analyzeIndustry({ url, siteText: crawl.siteText, mcpData });

  const warnings = [...mcpData.warnings];
  if (crawl.pagesSkipped.length > 0) {
    warnings.push(
      `Не удалось проанализировать ${crawl.pagesSkipped.length} страниц(-у). Продолжаем анализ без них.`
    );
  }

  const companyName = mcpData.company_name || crawl.companyNameGuess || new URL(
    /^https?:\/\//i.test(url) ? url : `https://${url}`
  ).hostname;

  if (!industryAnalysis.industry) {
    return NextResponse.json({
      industry: null,
      message: industryAnalysis.message ?? "Не удалось определить отрасль. Уточните её вручную для более точного анализа.",
      companyName,
      warnings,
    });
  }

  let agentsResponse;
  try {
    agentsResponse = await generateAgents({
      companyName,
      industry: industryAnalysis.industry,
      businessProcesses: industryAnalysis.business_processes,
      pains: industryAnalysis.pains,
    });
  } catch {
    return NextResponse.json(
      { error: "Извините, произошла ошибка. Попробуйте ещё раз." },
      { status: 502 }
    );
  }

  const company = await prisma.company.create({
    data: {
      name: companyName,
      url,
      industry: industryAnalysis.industry,
      description: industryAnalysis.sources.join(" "),
      mcpData: JSON.stringify(mcpData),
    },
  });

  const analysis = await prisma.analysis.create({
    data: {
      companyId: company.id,
      agents: JSON.stringify(agentsResponse.agents),
      summary: agentsResponse.summary,
      businessProcesses: JSON.stringify(industryAnalysis.business_processes),
      pains: JSON.stringify(industryAnalysis.pains),
      confidence: industryAnalysis.confidence ?? undefined,
    },
  });

  const result: AnalysisResult = {
    id: analysis.id,
    companyId: company.id,
    companyName: company.name,
    url: company.url,
    industry: company.industry,
    description: company.description,
    businessProcesses: industryAnalysis.business_processes,
    pains: industryAnalysis.pains,
    confidence: industryAnalysis.confidence,
    agents: agentsResponse.agents,
    summary: agentsResponse.summary,
    createdAt: analysis.createdAt.toISOString(),
    warnings,
  };

  return NextResponse.json(result);
}
