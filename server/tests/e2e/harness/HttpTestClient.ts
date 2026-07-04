const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 2000;

export interface JsonResponse {
  status: number;
  body: unknown;
  retryAfter: string | null;
  cacheControl: string | null;
}

export async function fetchJson(
  url: string,
  timeoutMs: number = DEFAULT_HTTP_REQUEST_TIMEOUT_MS
): Promise<JsonResponse> {
  const response = await fetchWithTimeout(url, timeoutMs);

  return {
    status: response.status,
    body: await response.json(),
    retryAfter: response.headers.get("retry-after"),
    cacheControl: response.headers.get("cache-control")
  };
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_HTTP_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    throw new Error(`HTTP request failed for ${url}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
