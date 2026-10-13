import createClient, { type Middleware } from "openapi-fetch";

import { recordServerDate } from "@/lib/clock";

import { API_URL } from "./config";
import type { paths } from "./schema";

const sentAt = new WeakMap<Request, number>();

const clockMiddleware: Middleware = {
  onRequest({ request }) {
    sentAt.set(request, Date.now());
    return request;
  },
  onResponse({ request, response }) {
    recordServerDate(response.headers.get("date"), sentAt.get(request) ?? Date.now(), Date.now());
    return response;
  },
};

export const api = createClient<paths>({ baseUrl: API_URL, credentials: "include" });
api.use(clockMiddleware);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Unwraps an openapi-fetch result, turning server errors into ApiError. */
export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (response.ok) return data as T;
  throw new ApiError(errorMessage(error) ?? response.statusText, response.status);
}

export function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: unknown; error?: unknown };
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return undefined;
}
