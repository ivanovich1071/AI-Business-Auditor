import { NextRequest, NextResponse } from "next/server";

import { cancelCrawl, markStaleCrawls } from "@/lib/crawler";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await markStaleCrawls();

  const job = await prisma.crawlJob.findUnique({
    where: { id },
    include: {
      company: { select: { name: true } },
      pages: {
        orderBy: [{ depth: "asc" }, { url: "asc" }],
        select: { id: true, url: true, title: true, depth: true, statusCode: true },
      },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Обход не найден." }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    startUrl: job.startUrl,
    status: job.status,
    maxPages: job.maxPages,
    maxDepth: job.maxDepth,
    pagesDone: job.pagesDone,
    pagesFailed: job.pagesFailed,
    error: job.error,
    companyId: job.companyId,
    companyName: job.company?.name ?? null,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    pages: job.pages,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.crawlJob.findUnique({ where: { id }, select: { status: true } });
  if (!job) {
    return NextResponse.json({ error: "Обход не найден." }, { status: 404 });
  }

  const isRunning = job.status === "running" || job.status === "queued";
  if (isRunning) {
    cancelCrawl(id);
    if (req.nextUrl.searchParams.get("mode") === "cancel") {
      // Engine stops at the next wave boundary and finalizes the row — pages stay.
      return NextResponse.json({ ok: true, cancelled: true });
    }
  }

  await prisma.crawlJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
