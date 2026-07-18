import type { McpData } from "@/types/analysis";
import { fetchDuckDuckGo } from "./duckduckgo";
import { fetchClearbit, fetchHunter, fetchOpenCorporates, fetchSerpApi } from "./optional";

export async function gatherMcpData(companyName: string | null, url: string): Promise<McpData> {
  const warnings: string[] = [];
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // ignore malformed url, domain stays empty
  }

  const nameForSearch = companyName || domain;

  const [ddg, serp, corp, clearbit, hunter] = await Promise.all([
    fetchDuckDuckGo(nameForSearch),
    fetchSerpApi(nameForSearch),
    fetchOpenCorporates(nameForSearch),
    fetchClearbit(domain),
    fetchHunter(domain),
  ]);

  if (!ddg) {
    warnings.push("Не удалось получить дополнительные данные из DuckDuckGo. Используем только информацию с сайта.");
  }

  const contacts: string[] = [];
  const otherParts: string[] = [];

  if (ddg?.abstract) otherParts.push(`DuckDuckGo: ${ddg.abstract}`);
  if (serp) otherParts.push("SerpAPI: данные получены");
  if (corp) otherParts.push("OpenCorporates: данные получены");
  if (clearbit) otherParts.push("Clearbit: данные получены");
  if (hunter) otherParts.push("Hunter.io: данные получены");

  return {
    industry: ddg?.category ?? null,
    company_name: companyName ?? ddg?.heading ?? null,
    size: null,
    contacts,
    other: otherParts.length > 0 ? otherParts.join(" | ") : null,
    warnings,
  };
}
