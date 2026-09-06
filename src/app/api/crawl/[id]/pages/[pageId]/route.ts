import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function fileNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const segment = url.pathname.split("/").filter(Boolean).pop() ?? "index";
    const clean = segment.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${clean || "page"}.md`;
  } catch {
    return "page.md";
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;

  const page = await prisma.crawledPage.findUnique({ where: { id: pageId } });
  if (!page || page.crawlId !== id) {
    return NextResponse.json({ error: "Страница не найдена." }, { status: 404 });
  }

  if (req.nextUrl.searchParams.get("download") === "1") {
    return new NextResponse(page.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileNameFromUrl(page.url)}"`,
      },
    });
  }

  return NextResponse.json({
    id: page.id,
    url: page.url,
    title: page.title,
    markdown: page.markdown,
    depth: page.depth,
    statusCode: page.statusCode,
    fetchedAt: page.fetchedAt.toISOString(),
  });
}
