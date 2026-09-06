import { NextRequest, NextResponse } from "next/server";

import { markStaleCrawls, runCrawl } from "@/lib/crawler";
import { normalizeUrl } from "@/lib/parser";
import { prisma } from "@/lib/prisma";
import { checkCrawlLimit, getClientIp, isUrlSafe } from "@/lib/security";

const MAX_PAGES_LIMIT = 500;
const MAX_DEPTH_LIMIT = 10;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? Math.round(value) : Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function hostnameOf(rawUrl: string): string | null {
  try {
    return new URL(normalizeUrl(rawUrl)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkCrawlLimit(ip)) {
    return NextResponse.json(
      { error: "Слишком много запусков обхода. Подождите несколько минут." },
      { status: 429 }
    );
  }

  let body: {
    url?: string;
    maxPages?: number;
    maxDepth?: number;
    respectRobots?: boolean;
    companyId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const url = body.url?.trim() || "";
  if (!url) {
    return NextResponse.json({ error: "Укажите URL сайта." }, { status: 400 });
  }
  if (!isUrlSafe(url)) {
    return NextResponse.json(
      { error: "Этот адрес не может быть проанализирован. Проверьте URL." },
      { status: 400 }
    );
  }

  const maxPages = clampInt(body.maxPages, 1, MAX_PAGES_LIMIT, 200);
  const maxDepth = clampInt(body.maxDepth, 1, MAX_DEPTH_LIMIT, 5);
  const respectRobots = body.respectRobots !== false;

  // Link the crawl to a company: explicit id wins, otherwise match by hostname.
  let companyId: string | null = body.companyId?.trim() || null;
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) companyId = null;
  } else {
    const host = hostnameOf(url);
    if (host) {
      const companies = await prisma.company.findMany({ select: { id: true, url: true } });
      companyId =
        companies.find((c) => hostnameOf(c.url) === host)?.id ?? null;
    }
  }

  const job = await prisma.crawlJob.create({
    data: {
      startUrl: normalizeUrl(url),
      maxPages,
      maxDepth,
      companyId,
      status: "queued",
    },
  });

  // Fire-and-forget: the crawl outlives this HTTP request; progress lands in the DB.
  void runCrawl({ jobId: job.id, startUrl: job.startUrl, maxPages, maxDepth, respectRobots });

  return NextResponse.json({ id: job.id });
}

export async function GET() {
  await markStaleCrawls();
  const jobs = await prisma.crawlJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { company: { select: { name: true } } },
  });
  return NextResponse.json(
    jobs.map((job) => ({
      id: job.id,
      startUrl: job.startUrl,
      status: job.status,
      maxPages: job.maxPages,
      maxDepth: job.maxDepth,
      pagesDone: job.pagesDone,
      pagesFailed: job.pagesFailed,
      companyId: job.companyId,
      companyName: job.company?.name ?? null,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    }))
  );
}
