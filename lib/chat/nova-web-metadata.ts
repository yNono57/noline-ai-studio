export type NovaWebSource = {
  url: string;
  title: string;
  domain?: string;
};

export type NovaUsageMetadata = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export const NOVA_INITIAL_SOURCE_LIMIT = 5;

const TRACKING_QUERY_PARAMETERS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid",
  "_ga", "_gl", "igshid", "vero_conv", "vero_id", "wickedid"
]);

export function readNovaWebSources(metadata: Record<string, unknown> | null): NovaWebSource[] {
  if (!metadata || !Array.isArray(metadata.sources)) return [];
  return deduplicateNovaWebSources(metadata.sources);
}

export function deduplicateNovaWebSources(candidates: unknown[]): NovaWebSource[] {
  const sources: NovaWebSource[] = [];
  const positions = new Map<string, number>();

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as Record<string, unknown>;
    const source = normalizeNovaWebSource(value.url, value.title);
    if (!source) continue;
    const existingIndex = positions.get(source.url);
    if (existingIndex === undefined) {
      positions.set(source.url, sources.length);
      sources.push(source);
      continue;
    }
    if (isFallbackTitle(sources[existingIndex]) && !isFallbackTitle(source)) {
      sources[existingIndex] = source;
    }
  }
  return sources;
}

export function normalizeNovaWebSource(urlValue: unknown, titleValue: unknown): NovaWebSource | null {
  if (typeof urlValue !== "string") return null;
  const canonicalUrl = canonicalizeNovaWebSourceUrl(urlValue);
  if (!canonicalUrl) return null;

  const url = new URL(canonicalUrl);
  const domain = url.hostname.replace(/^www\./, "");
  const title = typeof titleValue === "string" && titleValue.trim()
    ? titleValue.trim()
    : domain;
  return { url: canonicalUrl, title, domain };
}

export function canonicalizeNovaWebSourceUrl(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isFallbackTitle(source: NovaWebSource) {
  const normalized = source.title.toLowerCase().replace(/^www\./, "");
  return normalized === source.domain?.toLowerCase() || normalized === new URL(source.url).hostname.toLowerCase();
}
