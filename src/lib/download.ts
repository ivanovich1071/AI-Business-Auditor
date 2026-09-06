// Downloads via fetch + blob: recent Chrome builds block direct <a href> downloads
// over plain HTTP ("Insecure download blocked"), while page-context blob saves pass.
export function sanitizeFileName(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean || "site";
}

export function hostnameOf(rawUrl: string): string {
  try {
    return sanitizeFileName(new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).hostname);
  } catch {
    return "site";
  }
}

export function fileNameFromPageUrl(rawUrl: string): string {
  try {
    const segment = new URL(rawUrl).pathname.split("/").filter(Boolean).pop() ?? "index";
    const clean = segment.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${clean || "page"}.md`;
  } catch {
    return "page.md";
  }
}

export async function downloadViaBlob(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Скачивание не удалось: ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
