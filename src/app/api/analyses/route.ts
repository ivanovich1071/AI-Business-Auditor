import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AnalysisResult } from "@/types/analysis";

export async function GET() {
  const analyses = await prisma.analysis.findMany({
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });

  const result = analyses.map((a) => {
    let agentsCount = 0;
    try {
      const agents = JSON.parse(a.agents) as unknown[];
      agentsCount = Array.isArray(agents) ? agents.length : 0;
    } catch {
      agentsCount = 0;
    }
    return {
      id: a.id,
      companyId: a.companyId,
      companyName: a.company.name,
      url: a.company.url,
      industry: a.company.industry,
      agentsCount,
      summary: a.summary,
      createdAt: a.createdAt.toISOString(),
    };
  });

  return NextResponse.json(result);
}

/** Save an ephemeral analysis result to the dashboard. */
export async function POST(req: NextRequest) {
  let payload: Partial<AnalysisResult>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  if (!payload.companyName || !payload.url) {
    return NextResponse.json({ error: "Недостаточно данных для сохранения." }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: {
      name: payload.companyName,
      url: payload.url,
      industry: payload.industry ?? null,
      description: payload.description ?? null,
      mcpData: null,
    },
  });

  const analysis = await prisma.analysis.create({
    data: {
      companyId: company.id,
      agents: JSON.stringify(payload.agents ?? []),
      summary: payload.summary ?? "",
      businessProcesses: JSON.stringify(payload.businessProcesses ?? []),
      departments: JSON.stringify(payload.departments ?? []),
      pains: JSON.stringify(payload.pains ?? []),
      confidence: payload.confidence ?? undefined,
    },
  });

  const result: AnalysisResult = {
    id: analysis.id,
    companyId: company.id,
    companyName: company.name,
    url: company.url,
    industry: company.industry,
    description: company.description,
    businessProcesses: payload.businessProcesses ?? [],
    departments: payload.departments ?? [],
    pains: payload.pains ?? [],
    confidence: payload.confidence ?? null,
    agents: payload.agents ?? [],
    summary: payload.summary ?? "",
    createdAt: analysis.createdAt.toISOString(),
    warnings: [],
    saved: true,
  };

  return NextResponse.json(result);
}
