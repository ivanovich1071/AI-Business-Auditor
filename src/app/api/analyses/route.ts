import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const analyses = await prisma.analysis.findMany({
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });

  const result = analyses.map((a) => {
    const agents = JSON.parse(a.agents) as unknown[];
    return {
      id: a.id,
      companyId: a.companyId,
      companyName: a.company.name,
      url: a.company.url,
      industry: a.company.industry,
      agentsCount: agents.length,
      summary: a.summary,
      createdAt: a.createdAt.toISOString(),
    };
  });

  return NextResponse.json(result);
}
