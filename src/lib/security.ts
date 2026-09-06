const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// Full-site crawls are heavy (minutes of outbound requests) — stricter window.
const CRAWL_LIMIT_WINDOW_MS = 5 * 60_000;
const CRAWL_LIMIT_MAX = 5;

const hits = new Map<string, number[]>();
const crawlHits = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    hits.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return true;
}

export function checkCrawlLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (crawlHits.get(ip) ?? []).filter((t) => now - t < CRAWL_LIMIT_WINDOW_MS);
  if (timestamps.length >= CRAWL_LIMIT_MAX) {
    crawlHits.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  crawlHits.set(ip, timestamps);
  return true;
}

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
];

export function isUrlSafe(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return !BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
