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
  return fetchAndConsume(url, timeoutMs, "HTTP JSON response", async (response) => ({
    status: response.status,
    body: await response.json(),
    retryAfter: response.headers.get("retry-after"),
    cacheControl: response.headers.get("cache-control")
  }));
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_HTTP_REQUEST_TIMEOUT_MS
): Promise<Response> {
  return fetchAndConsume(url, timeoutMs, "HTTP response", (response) => response);
}

async function fetchAndConsume<T>(
  url: string,
  timeoutMs: number,
  operation: string,
  consume: (response: Response) => T | Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      throw createRequestError(error);
    }

    try {
      return await consume(response);
    } catch (error) {
      if (timedOut) {
        throw createRequestError(error);
      }
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }

  function createRequestError(cause: unknown): Error {
    if (timedOut) {
      return new Error(`Timed out after ${timeoutMs}ms waiting for ${operation} from "${url}"`, {
        cause
      });
    }

    return new Error(`HTTP request failed for ${url}`, { cause });
  }
}
