/**
 * Optional MCP sources — only activate when the corresponding API key is present
 * in .env. Each function fails soft (returns null) so a missing/invalid key never
 * breaks the pipeline, per CLAUDE.md §8.
 */

export interface OptionalMcpFragment {
  source: string;
  data: Record<string, unknown>;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 5000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSerpApi(companyName: string): Promise<OptionalMcpFragment | null> {
  const key = process.env.SERPAPI_KEY;
  if (!key || !companyName) return null;
  const params = new URLSearchParams({ q: companyName, engine: "google", api_key: key });
  const data = await fetchJsonWithTimeout(`https://serpapi.com/search.json?${params.toString()}`);
  if (!data || typeof data !== "object") return null;
  return { source: "serpapi", data: data as Record<string, unknown> };
}

export async function fetchOpenCorporates(companyName: string): Promise<OptionalMcpFragment | null> {
  // OpenCorporates search works without a key at low volume, but we still gate it
  // behind an explicit env flag to keep behavior predictable per CLAUDE.md.
  const key = process.env.OPENCORPORATES_API_KEY;
  if (!key || !companyName) return null;
  const params = new URLSearchParams({ q: companyName, api_token: key });
  const data = await fetchJsonWithTimeout(
    `https://api.opencorporates.com/v0.4/companies/search?${params.toString()}`
  );
  if (!data || typeof data !== "object") return null;
  return { source: "opencorporates", data: data as Record<string, unknown> };
}

export async function fetchClearbit(domain: string): Promise<OptionalMcpFragment | null> {
  const key = process.env.CLEARBIT_API_KEY;
  if (!key || !domain) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { source: "clearbit", data };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHunter(domain: string): Promise<OptionalMcpFragment | null> {
  const key = process.env.HUNTER_API_KEY;
  if (!key || !domain) return null;
  const params = new URLSearchParams({ domain, api_key: key });
  const data = await fetchJsonWithTimeout(`https://api.hunter.io/v2/domain-search?${params.toString()}`);
  if (!data || typeof data !== "object") return null;
  return { source: "hunter", data: data as Record<string, unknown> };
}
