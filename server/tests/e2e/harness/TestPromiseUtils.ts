export interface ControlledPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
}

/**
 * Creates a promise whose resolve/reject functions are exposed to the test.
 * Useful when a test needs to pause production code at a known async point.
 */
export function createControlledPromise<T = void>(): ControlledPromise<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

export async function getRejectedError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject");
}

export function requireError(error: unknown): Error {
  if (!(error instanceof Error)) {
    throw new Error(`Expected Error, got ${String(error)}`);
  }

  return error;
}

export function requireAggregateError(error: unknown): AggregateError {
  if (!(error instanceof AggregateError)) {
    throw new Error(`Expected AggregateError, got ${String(error)}`);
  }

  return error;
}

export function getAggregateErrors(error: AggregateError): readonly unknown[] {
  return error.errors as readonly unknown[];
}

export function findErrorByMessage(
  errors: readonly unknown[],
  message: string
): Error | undefined {
  return errors.find(
    (error): error is Error => error instanceof Error && error.message === message
  );
}

export function flattenErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const visit = (current: unknown): void => {
    if (current instanceof AggregateError) {
      messages.push(current.message);
      for (const nested of getAggregateErrors(current)) {
        visit(nested);
      }
      visit(current.cause);
      return;
    }

    if (current instanceof Error) {
      messages.push(current.message);
      visit(current.cause);
      return;
    }

    if (current !== undefined) {
      messages.push(String(current));
    }
  };

  visit(error);
  return messages;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${operation}`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
