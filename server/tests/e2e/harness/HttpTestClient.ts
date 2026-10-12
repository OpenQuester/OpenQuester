import request, { type Response as TestResponse, type Test } from "supertest";

const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 2000;

type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export type HttpTestClient = Record<HttpMethod, (path: string) => Test>;

/** Real, bounded HTTP requests with explicit cookies instead of a shared cookie jar. */
export function createHttpTestClient(
  serverUrl: string,
  timeoutMs: number = DEFAULT_HTTP_REQUEST_TIMEOUT_MS
): HttpTestClient {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("HTTP test request timeout must be a positive finite number");
  }
  const client = request(serverUrl);
  const send = (method: HttpMethod, path: string): Test => {
    const operation = client[method](path);
    const end = operation.end.bind(operation);
    operation.end = (callback) => {
      let settled = false;
      const complete = (error: unknown, response?: TestResponse): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        let failure = error;
        if (error) {
          const message =
            typeof error === "object" && "message" in error && typeof error.message === "string"
              ? error.message
              : String(error);
          failure = new Error(`HTTP ${method.toUpperCase()} ${operation.url}: ${message}`, {
            cause: error
          });
        }
        // Superagent supplies no response on a connection/timeout error despite its callback type.
        callback?.(failure, response!);
      };
      const timeout = setTimeout(() => {
        // Settle before abort: native partial-body deadlines invoke superagent's callback twice.
        try {
          complete(new Error(`Timeout of ${timeoutMs}ms exceeded`));
        } finally {
          operation.abort();
        }
      }, timeoutMs);
      try {
        return end(complete);
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    };
    return operation;
  };

  return {
    get: (path: string) => send("get", path),
    post: (path: string) => send("post", path),
    put: (path: string) => send("put", path),
    patch: (path: string) => send("patch", path),
    delete: (path: string) => send("delete", path),
    head: (path: string) => send("head", path),
    options: (path: string) => send("options", path)
  };
}

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
