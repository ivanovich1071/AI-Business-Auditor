import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";

import { prisma } from "@/lib/prisma";
import { fetchWithTimeout, isNonHtmlPath, normalizeUrl, PRIORITY_PATH_HINTS } from "@/lib/parser";

const WAVE_SIZE = 3;
const WAVE_PAUSE_MS = 300;
const MAX_HTML_CHARS = 3_000_000; // pathological pages (multi-MB DOM) can starve the event loop
const MAX_MARKDOWN_CHARS = 150_000;
const MIN_MARKDOWN_CHARS = 30;
const MAX_SITEMAP_URLS = 2_000;
const STALE_CRAWL_MS = 30 * 60_000;
const TRACKING_PARAMS = /^(utm_|gclid|fbclid|yclid|msclkid|_ga|mc_cid|mc_eid)/i;

const htmlConverter = new NodeHtmlMarkdown({}, undefined, undefined);

interface QueueItem {
  url: URL;
  depth: number;
}

interface CrawledPageData {
  url: string;
  title: string;
  markdown: string;
  depth: number;
  statusCode: number;
}

interface WaveOutcome {
  page: CrawledPageData | null;
  newLinks: QueueItem[];
}

interface RobotsRules {
  disallow: string[];
  allow: string[];
}

// Cancellation lives in memory: a crawl runs inside this Node process. A job
// that outlives a process restart is finalized by markStaleCrawls() instead.
const cancelledJobs = new Set<string>();

export function cancelCrawl(jobId: string): void {
  cancelledJobs.add(jobId);
}

export async function markStaleCrawls(): Promise<void> {
  await prisma.crawlJob
    .updateMany({
      where: {
        status: { in: ["queued", "running"] },
        updatedAt: { lt: new Date(Date.now() - STALE_CRAWL_MS) },
      },
      data: { status: "error", error: "Обход прерван перезапуском сервера.", finishedAt: new Date() },
    })
    .catch(() => undefined);
}

export interface StartCrawlOptions {
  jobId: string;
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  respectRobots: boolean;
}

export async function runCrawl(opts: StartCrawlOptions): Promise<void> {
  const { jobId, maxPages, maxDepth, respectRobots } = opts;
  const update = (data: Record<string, unknown>) =>
    prisma.crawlJob.update({ where: { id: jobId }, data }).catch(() => undefined);

  try {
    const startUrlStr = await resolveStartUrl(opts.startUrl);
    const startUrl = new URL(startUrlStr);

    let robots: RobotsRules | null = null;
    let sitemapHints: string[] = [];
    if (respectRobots) {
      const parsed = await fetchRobots(startUrl.origin);
      robots = parsed.rules;
      sitemapHints = parsed.sitemaps;
    }

    await update({ status: "running" });

    const visited = new Set<string>([queueKey(startUrl)]);
    const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];

    for (const raw of await collectSitemapUrls(startUrl.origin, sitemapHints)) {
      const url = resolveCrawlUrl(raw, startUrl);
      if (!url || url.origin !== startUrl.origin) continue;
      const key = queueKey(url);
      if (visited.has(key) || isNonHtmlPath(url.pathname)) continue;
      if (robots && !isAllowedByRobots(url, robots)) continue;
      visited.add(key);
      queue.push({ url, depth: 1 });
    }
    const seeds = queue.splice(1).sort(bySectionPriority);
    queue.push(...seeds);

    let pagesDone = 0;
    let pagesFailed = 0;

    while (queue.length > 0 && pagesDone < maxPages) {
      if (cancelledJobs.has(jobId)) {
        cancelledJobs.delete(jobId);
        await update({ status: "cancelled", finishedAt: new Date() });
        return;
      }

      const wave = queue.splice(0, Math.min(WAVE_SIZE, maxPages - pagesDone));
      const outcomes = await Promise.all(
        wave.map((item) => fetchPage(item, { robots, maxDepth }))
      );

      const rows: (CrawledPageData & { crawlId: string })[] = [];
      const discovered: QueueItem[] = [];
      for (const outcome of outcomes) {
        if (outcome.page) {
          pagesDone += 1;
          rows.push({ crawlId: jobId, ...outcome.page });
        } else {
          pagesFailed += 1;
        }
        discovered.push(...outcome.newLinks);
      }

      if (rows.length > 0) {
        await prisma.crawledPage.createMany({ data: rows }).catch(() => undefined);
      }
      await update({ pagesDone, pagesFailed });

      for (const link of discovered.sort(bySectionPriority)) {
        const key = queueKey(link.url);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push(link);
      }

      if (queue.length > 0) await sleep(WAVE_PAUSE_MS);
    }

    await update({ status: "done", finishedAt: new Date() });
  } catch (err) {
    cancelledJobs.delete(jobId);
    await update({
      status: "error",
      error: err instanceof Error ? err.message : "Неизвестная ошибка обхода.",
      finishedAt: new Date(),
    });
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function resolveStartUrl(rawUrl: string): Promise<string> {
  const normalized = normalizeUrl(rawUrl);
  const message = "Сайт недоступен. Проверьте URL или попробуйте позже.";
  const tryFetch = async (target: string) => {
    const res = await fetchWithTimeout(target);
    if (!res.ok) throw new Error(message);
    return res;
  };
  try {
    await tryFetch(normalized);
    return normalized;
  } catch {
    // Some sites fail on https but respond over plain http — same fallback as parser.ts.
    const explicit = /^https?:\/\//i.test(rawUrl.trim());
    if (explicit || !normalized.startsWith("https://")) throw new Error(message);
    const httpUrl = normalized.replace(/^https:\/\//, "http://");
    await tryFetch(httpUrl);
    return httpUrl;
  }
}

async function fetchPage(
  item: QueueItem,
  ctx: { robots: RobotsRules | null; maxDepth: number }
): Promise<WaveOutcome> {
  const { url, depth } = item;
  try {
    const res = await fetchWithTimeout(url.toString());
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.toLowerCase().includes("text/html")) {
      return { page: null, newLinks: [] };
    }
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    const $ = cheerio.load(html);
    const title =
      $("title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      `${url.hostname}${url.pathname}`;
    const markdown = buildMarkdown($, url, title);
    const newLinks = collectLinks($, url, ctx.robots, ctx.maxDepth, depth);
    if (markdown.length < MIN_MARKDOWN_CHARS) {
      // Hub page without content — still worth following its links.
      return { page: null, newLinks };
    }
    return {
      page: { url: url.toString(), title, markdown, depth, statusCode: res.status },
      newLinks,
    };
  } catch {
    return { page: null, newLinks: [] };
  }
}

function buildMarkdown($: cheerio.CheerioAPI, url: URL, title: string): string {
  $("script, style, noscript, svg, iframe, template").remove();
  const bodyHtml = $("body").html() ?? $.html() ?? "";
  const body = htmlConverter
    .translate(bodyHtml)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const header = `# ${title}\n\n> Источник: ${url.toString()} · ${new Date().toLocaleDateString("ru-RU")}\n\n`;
  return (header + body).slice(0, MAX_MARKDOWN_CHARS);
}

function resolveCrawlUrl(href: string, baseUrl: URL): URL | null {
  try {
    const resolved = new URL(href, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    resolved.hash = "";
    for (const key of Array.from(resolved.searchParams.keys())) {
      if (TRACKING_PARAMS.test(key)) resolved.searchParams.delete(key);
    }
    return resolved;
  } catch {
    return null;
  }
}

function queueKey(url: URL): string {
  let s = url.toString();
  if (url.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function bySectionPriority(a: QueueItem, b: QueueItem): number {
  const score = (u: URL) =>
    PRIORITY_PATH_HINTS.some((hint) => u.pathname.toLowerCase().includes(hint)) ? 0 : 1;
  return score(a.url) - score(b.url);
}

function collectLinks(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  rules: RobotsRules | null,
  maxDepth: number,
  currentDepth: number
): QueueItem[] {
  if (currentDepth >= maxDepth) return [];
  const seen = new Set<string>();
  const links: QueueItem[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = resolveCrawlUrl(href, pageUrl);
    if (!resolved || resolved.origin !== pageUrl.origin) return;
    if (isNonHtmlPath(resolved.pathname)) return;
    if (rules && !isAllowedByRobots(resolved, rules)) return;
    const key = queueKey(resolved);
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ url: resolved, depth: currentDepth + 1 });
  });
  return links.sort(bySectionPriority);
}

async function fetchRobots(origin: string): Promise<{ rules: RobotsRules | null; sitemaps: string[] }> {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`);
    if (!res.ok) return { rules: null, sitemaps: [] };
    return parseRobots(await res.text());
  } catch {
    return { rules: null, sitemaps: [] };
  }
}

function parseRobots(text: string): { rules: RobotsRules; sitemaps: string[] } {
  const rules: RobotsRules = { disallow: [], allow: [] };
  const sitemaps: string[] = [];
  let starGroup = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === "user-agent") {
      starGroup = value === "*";
    } else if (key === "sitemap") {
      if (value) sitemaps.push(value);
    } else if (starGroup && value) {
      if (key === "disallow") rules.disallow.push(value);
      else if (key === "allow") rules.allow.push(value);
    }
  }
  return { rules, sitemaps };
}

function isAllowedByRobots(url: URL, rules: RobotsRules): boolean {
  const path = `${url.pathname}${url.search}`;
  const bestMatch = (patterns: string[]) => {
    let len = -1;
    for (const p of patterns) {
      if (robotsPatternMatches(p, path) && p.length > len) len = p.length;
    }
    return len;
  };
  const allowLen = bestMatch(rules.allow);
  const disallowLen = bestMatch(rules.disallow);
  if (allowLen < 0 && disallowLen < 0) return true;
  return allowLen >= disallowLen;
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  let p = pattern;
  let anchoredEnd = false;
  if (p.endsWith("$")) {
    anchoredEnd = true;
    p = p.slice(0, -1);
  }
  const regex = `^${p.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}${anchoredEnd ? "$" : ""}`;
  try {
    return new RegExp(regex).test(path);
  } catch {
    return false;
  }
}

async function collectSitemapUrls(origin: string, sitemapHints: string[]): Promise<string[]> {
  const candidates = Array.from(new Set([...sitemapHints, `${origin}/sitemap.xml`])).slice(0, 6);
  const urls: string[] = [];
  const locPattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

  const readLocs = async (sitemapUrl: string): Promise<string[]> => {
    const res = await fetchWithTimeout(sitemapUrl);
    if (!res.ok) return [];
    const xml = await res.text();
    if (!/<sitemapindex[\s>]/i.test(xml)) {
      return [...xml.matchAll(locPattern)].map((m) => m[1]);
    }
    // Sitemap index — one level of nesting.
    const nested = [...xml.matchAll(locPattern)].map((m) => m[1]).slice(0, 20);
    const childUrls: string[] = [];
    for (const child of nested) {
      if (childUrls.length >= MAX_SITEMAP_URLS) break;
      try {
        childUrls.push(...(await readLocs(child)));
      } catch {
        // ignore child sitemap failures
      }
    }
    return childUrls;
  };

  for (const candidate of candidates) {
    if (urls.length >= MAX_SITEMAP_URLS) break;
    try {
      urls.push(...(await readLocs(candidate)));
    } catch {
      // sitemap is optional
    }
  }
  return urls.slice(0, MAX_SITEMAP_URLS);
}
