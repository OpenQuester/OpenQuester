/**
 * Inside a Discord Activity the page may only load from its own
 * `{clientId}.discordsays.com` host, which forwards path prefixes to the real
 * hosts (the Developer Portal's URL mappings). The Embedded App SDK patches
 * fetch, WebSocket, XHR and `src` attributes in the document; this covers the
 * media elements we create off-document (preloading), which it can't see.
 */
export interface UrlMapping {
  /** Path on the Activity's own host, e.g. `/media` */
  prefix: string;
  /** Host (and optional path) it forwards to, without the scheme */
  target: string;
}

let mappings: UrlMapping[] = [];

export function setUrlMappings(next: UrlMapping[]): void {
  mappings = next;
}

/** The URL to load `url` from on this page: unchanged unless a mapping covers it. */
export function mapUrl(url: string): string {
  if (mappings.length === 0) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return url;
  }
  if (parsed.host === window.location.host) return url;
  for (const { prefix, target } of mappings) {
    const to = new URL(`https://${target}`);
    const base = to.pathname.replace(/\/$/, "");
    if (parsed.host !== to.host || !parsed.pathname.startsWith(base)) continue;
    const rest = parsed.pathname.slice(base.length).replace(/^\//, "");
    const path = `${prefix.replace(/\/$/, "")}/${rest}`;
    return `${window.location.origin}${path}${parsed.search}${parsed.hash}`;
  }
  return url;
}
