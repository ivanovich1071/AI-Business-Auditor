import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AnalysisResult } from "@/types/analysis";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Анализ не найден." }, { status: 404 });
  }

  const result: AnalysisResult = {
    id: analysis.id,
    companyId: analysis.companyId,
    companyName: analysis.company.name,
    url: analysis.company.url,
    industry: analysis.company.industry,
    description: analysis.company.description,
    businessProcesses: JSON.parse(analysis.businessProcesses),
    pains: JSON.parse(analysis.pains),
    confidence: analysis.confidence,
    agents: JSON.parse(analysis.agents),
    summary: analysis.summary,
    createdAt: analysis.createdAt.toISOString(),
    warnings: [],
  };

  return NextResponse.json(result);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({ where: { id } });
  if (!analysis) {
    return NextResponse.json({ error: "Анализ не найден." }, { status: 404 });
  }
  await prisma.analysis.delete({ where: { id } });

  const remaining = await prisma.analysis.count({ where: { companyId: analysis.companyId } });
  if (remaining === 0) {
    await prisma.company.delete({ where: { id: analysis.companyId } });
  }

  return NextResponse.json({ ok: true });
}
