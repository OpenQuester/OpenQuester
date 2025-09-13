interface ApiErrorPayload {
  message?: string;
  error?: string;
  [k: string]: unknown;
}

/**
 * Standardized API error class for all API operations
 */
export class ApiError extends Error {
  public readonly status?: number;
  public readonly payload?: ApiErrorPayload;
  public readonly op: string;

  constructor(op: string, raw: unknown) {
    const res = (raw as any)?.response;
    const payload: ApiErrorPayload | undefined = res?.data;
    const base =
      payload?.message ||
      payload?.error ||
      (raw instanceof Error ? raw.message : "Request failed");
    super(`[${op}] ${base}`);
    this.op = op;
    this.status = res?.status;
    this.payload = payload;
    if (raw instanceof Error && raw.stack) {
      this.stack += `\nCaused by: ${raw.stack}`;
    }
  }
}

/**
 * Wrapper utility for API operations with consistent error handling
 */
export async function wrap<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ApiError(op, err);
  }
}
