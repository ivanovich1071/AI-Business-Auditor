import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function safeFileName(raw: string, fallback: string): string {
  const clean = raw
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || fallback;
}

function zipEntryName(rawUrl: string, used: Set<string>): string {
  let raw = "index";
  try {
    raw = new URL(rawUrl).pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") || "index";
  } catch {
    // keep fallback
  }
  const clean = safeFileName(raw, "page").replace(/\.md$/i, "") || "page";
  let name = `${clean}.md`;
  let counter = 2;
  while (used.has(name)) {
    name = `${clean}-${counter}.md`;
    counter += 1;
  }
  used.add(name);
  return name;
}

function buildToc(pages: { url: string; title: string | null }[]): string {
  return pages.map((p, i) => `${i + 1}. ${p.title || p.url} — ${p.url}`).join("\n");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") === "zip" ? "zip" : "md";

  const job = await prisma.crawlJob.findUnique({
    where: { id },
    include: { pages: { orderBy: [{ depth: "asc" }, { url: "asc" }] } },
  });
  if (!job) {
    return NextResponse.json({ error: "Обход не найден." }, { status: 404 });
  }

  const host = safeFileName(new URL(job.startUrl).hostname, "site");
  const toc = buildToc(job.pages);

  if (format === "md") {
    const body = [
      `# Снапшот сайта ${host}`,
      "",
      `- Обход: ${job.startUrl}`,
      `- Страниц: ${job.pages.length}`,
      `- Дата: ${new Date().toLocaleDateString("ru-RU")}`,
      "",
      "## Оглавление",
      "",
      toc,
      "",
      job.pages.map((p) => `---\n\n${p.markdown}`).join("\n\n"),
    ].join("\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${host}-crawl.md"`,
      },
    });
  }

  const zip = new JSZip();
  zip.file(
    "index.md",
    [
      `# Снапшот сайта ${host}`,
      "",
      `- Обход: ${job.startUrl}`,
      `- Страниц: ${job.pages.length}`,
      `- Дата: ${new Date().toLocaleDateString("ru-RU")}`,
      "",
      "## Оглавление",
      "",
      toc,
    ].join("\n")
  );
  const used = new Set<string>();
  for (const page of job.pages) {
    zip.file(zipEntryName(page.url, used), page.markdown);
  }
  const archive = await zip.generateAsync({ type: "arraybuffer" });
  return new NextResponse(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${host}-crawl.zip"`,
    },
  });
}
