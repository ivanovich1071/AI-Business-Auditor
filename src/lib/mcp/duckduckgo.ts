export interface DuckDuckGoResult {
  heading: string | null;
  abstract: string | null;
  category: string | null;
  relatedTopics: string[];
}

/**
 * Free, keyless source: DuckDuckGo Instant Answer API.
 * Returns null on any failure so the aggregator can degrade gracefully.
 */
export async function fetchDuckDuckGo(companyName: string): Promise<DuckDuckGoResult | null> {
  if (!companyName) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const params = new URLSearchParams({
      q: companyName,
      format: "json",
      no_html: "1",
      skip_disambig: "1",
    });
    const res = await fetch(`https://api.duckduckgo.com/?${params.toString()}`, {
      signal: controller.signal,
      headers: { "User-Agent": "AIBusinessAuditorBot/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      heading: data.Heading || null,
      abstract: data.AbstractText || null,
      category: data.AbstractSource || null,
      relatedTopics: Array.isArray(data.RelatedTopics)
        ? data.RelatedTopics.map((t: { Text?: string }) => t.Text).filter(Boolean).slice(0, 5)
        : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
