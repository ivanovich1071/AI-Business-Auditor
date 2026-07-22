import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeAgents,
  normalizeBusinessProcesses,
  type AgentSuggestion,
  type AnalysisResult,
  type BusinessProcess,
} from "@/types/analysis";

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Анализ не найден." }, { status: 404 });
  }

  let businessProcesses: BusinessProcess[];
  let agents: AgentSuggestion[];
  try {
    businessProcesses = normalizeBusinessProcesses(JSON.parse(analysis.businessProcesses));
  } catch {
    businessProcesses = [];
  }
  try {
    agents = normalizeAgents(JSON.parse(analysis.agents));
  } catch {
    agents = [];
  }

  const result: AnalysisResult = {
    id: analysis.id,
    companyId: analysis.companyId,
    companyName: analysis.company.name,
    url: analysis.company.url,
    industry: analysis.company.industry,
    description: analysis.company.description,
    businessProcesses,
    departments: parseStringArray(analysis.departments),
    pains: parseStringArray(analysis.pains),
    confidence: analysis.confidence,
    agents,
    summary: analysis.summary,
    createdAt: analysis.createdAt.toISOString(),
    warnings: [],
    saved: true,
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
