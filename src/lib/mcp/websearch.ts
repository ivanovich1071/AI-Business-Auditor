/**
 * Keyless web search — same data source that the OEvortex/ddg_search MCP wraps
 * (DuckDuckGo). We call DuckDuckGo directly instead of running a separate MCP
 * process, because the deployed Next.js app cannot reach MCP servers configured
 * for Claude Code. Used to resolve a company site from its name when the user
 * did not supply a URL.
 */

export interface WebSearchResult {
  title: string;
  url: string;
}

const TIMEOUT_MS = 8000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function decodeUddg(href: string): string | null {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : null;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** DuckDuckGo HTML "lite" search (GET — the POST form is bot-gated). */
export async function webSearch(query: string, limit = 10): Promise<WebSearchResult[]> {
  if (!query.trim()) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      { signal: controller.signal, headers: { "User-Agent": UA, Accept: "text/html" } }
    );
    if (!res.ok) return [];
    const html = await res.text();

    const results: WebSearchResult[] = [];
    const seen = new Set<string>();
    // Result anchors carry a redirect href containing uddg=<encoded-url>.
    const anchorRe = /<a[^>]+href="([^"]*uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(html)) && results.length < limit) {
      const url = decodeUddg(m[1]);
      if (!url || seen.has(url) || !/^https?:\/\//i.test(url)) continue;
      seen.add(url);
      results.push({ url, title: stripTags(m[2]) });
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** DuckDuckGo Instant Answer API — returns an official site for known entities. */
async function instantAnswerSite(name: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(name)}&format=json&no_html=1&t=aiba`,
      { signal: controller.signal, headers: { "User-Agent": UA } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first: string | undefined = data?.Results?.[0]?.FirstURL;
    if (first && /^https?:\/\//i.test(first) && !/wikipedia\.org/i.test(first)) return first;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const BAD_HOST_HINTS = [
  "wikipedia.org",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "vk.com",
  "ok.ru",
  "t.me",
  "telegram.",
  "rusprofile",
  "list-org",
  "spark-interfax",
  "zoominfo",
  "crunchbase",
  "google.",
  "yandex.",
  "bing.",
  "2gis.",
  "flamp.",
  "otzyv",
  "review",
  "tiktok.",
];

/**
 * Resolve the most likely official website for a company name.
 * IA API first (best for well-known entities), then filtered lite search.
 */
export async function resolveCompanySite(name: string): Promise<string | null> {
  const ia = await instantAnswerSite(name);
  if (ia) return ia;

  const queries = [`${name} официальный сайт`, `${name} official site`, name];
  for (const q of queries) {
    const results = await webSearch(q, 10);
    for (const r of results) {
      let host = "";
      try {
        host = new URL(r.url).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (BAD_HOST_HINTS.some((bad) => host.includes(bad))) continue;
      return r.url;
    }
  }
  return null;
}
