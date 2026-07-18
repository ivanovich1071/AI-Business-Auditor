import * as cheerio from "cheerio";

const MAX_PAGES = 8;
const MAX_CHARS_PER_PAGE = 6000;
const MAX_TOTAL_CHARS = 20000;
const FETCH_TIMEOUT_MS = 8000;
const PRIORITY_PATH_HINTS = [
  "about",
  "o-nas",
  "o_nas",
  "company",
  "services",
  "uslugi",
  "products",
  "produkty",
  "team",
  "komanda",
  "contact",
  "kontakty",
];

export class SiteUnavailableError extends Error {}

interface FetchedPage {
  url: string;
  text: string;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

function hadExplicitScheme(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIBusinessAuditorBot/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, svg, iframe").remove();
  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content") ?? "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  return [title, metaDescription, bodyText].filter(Boolean).join(". ").slice(0, MAX_CHARS_PER_PAGE);
}

function collectInternalLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.origin !== origin) return;
      resolved.hash = "";
      const clean = resolved.toString();
      if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|docx?|xlsx?|mp4|css|js)$/i.test(clean)) return;
      links.add(clean);
    } catch {
      // ignore invalid URLs
    }
  });
  return Array.from(links).sort((a, b) => {
    const aScore = PRIORITY_PATH_HINTS.some((hint) => a.toLowerCase().includes(hint)) ? 0 : 1;
    const bScore = PRIORITY_PATH_HINTS.some((hint) => b.toLowerCase().includes(hint)) ? 0 : 1;
    return aScore - bScore;
  });
}

const GENERIC_TITLE_WORDS = new Set(["home", "index", "главная", "welcome"]);

function guessNameFromTitle(rawTitle: string): string | null {
  const segments = rawTitle
    .split(/[-|–—\\/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const specific = segments.find((s) => !GENERIC_TITLE_WORDS.has(s.toLowerCase()));
  return specific ?? segments[0] ?? null;
}

export interface CrawlResult {
  siteText: string;
  pagesFetched: string[];
  pagesSkipped: string[];
  companyNameGuess: string | null;
}

export async function crawlSite(rawUrl: string): Promise<CrawlResult> {
  let startUrl = normalizeUrl(rawUrl);

  let homeResponse: Response;
  try {
    homeResponse = await fetchWithTimeout(startUrl);
    if (!homeResponse.ok) throw new Error(`status ${homeResponse.status}`);
  } catch {
    // Some sites (e.g. misconfigured TLS chains) fail on https but work over
    // plain http — only worth retrying when the user didn't pin a scheme.
    if (hadExplicitScheme(rawUrl) || !startUrl.startsWith("https://")) {
      throw new SiteUnavailableError("Сайт недоступен. Проверьте URL или попробуйте позже.");
    }
    const httpUrl = startUrl.replace(/^https:\/\//, "http://");
    try {
      homeResponse = await fetchWithTimeout(httpUrl);
      if (!homeResponse.ok) throw new Error(`status ${homeResponse.status}`);
      startUrl = httpUrl;
    } catch {
      throw new SiteUnavailableError("Сайт недоступен. Проверьте URL или попробуйте позже.");
    }
  }

  const pagesFetched: string[] = [];
  const pagesSkipped: string[] = [];
  const visited = new Set<string>();
  const textChunks: FetchedPage[] = [];

  const homeHtml = await homeResponse.text();
  const home$ = cheerio.load(homeHtml);
  textChunks.push({ url: startUrl, text: extractText(home$) });
  pagesFetched.push(startUrl);
  visited.add(startUrl);

  const companyNameGuess =
    home$('meta[property="og:site_name"]').attr("content")?.trim() || guessNameFromTitle(home$("title").first().text());

  const remainingSlots = MAX_PAGES - pagesFetched.length;
  const candidateLinks = collectInternalLinks(home$, startUrl)
    .filter((l) => !visited.has(l))
    .slice(0, remainingSlots);
  candidateLinks.forEach((l) => visited.add(l));

  const fetchedPages = await Promise.all(
    candidateLinks.map(async (link) => {
      try {
        const res = await fetchWithTimeout(link);
        if (!res.ok) return { link, page: null };
        const html = await res.text();
        const $ = cheerio.load(html);
        return { link, page: { url: link, text: extractText($) } as FetchedPage };
      } catch {
        return { link, page: null };
      }
    })
  );

  for (const { link, page } of fetchedPages) {
    if (page) {
      textChunks.push(page);
      pagesFetched.push(link);
    } else {
      pagesSkipped.push(link);
    }
  }

  const siteText = textChunks
    .map((p) => p.text)
    .join("\n\n")
    .slice(0, MAX_TOTAL_CHARS);

  return { siteText, pagesFetched, pagesSkipped, companyNameGuess };
}
