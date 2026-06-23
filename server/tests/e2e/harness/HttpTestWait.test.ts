import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createServer } from "http";

import { waitForHttpListeningOrStartupFailure } from "tests/e2e/harness/HttpTestWait";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
}

const timeoutMs = 2000;

const createDeferred = <T = void>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
};

const getRejectedError = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("Expected promise to reject");
};

const requireError = (error: unknown): Error => {
  if (!(error instanceof Error)) {
    throw new Error(`Expected Error, got ${String(error)}`);
  }

  return error;
};

describe("HttpTestWait", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("wraps early startup rejection and removes only its own HTTP listeners", async () => {
    const httpServer = createServer();
    const startup = createDeferred();
    const startupFailure = new Error("session config failed before HTTP listen");
    const unrelatedListening = jest.fn();
    const unrelatedError = jest.fn();
    httpServer.on("listening", unrelatedListening);
    httpServer.on("error", unrelatedError);
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs
    });

    expect(httpServer.listenerCount("listening")).toBe(baselineListeningListeners + 1);
    expect(httpServer.listenerCount("error")).toBe(baselineErrorListeners + 1);

    startup.reject(startupFailure);
    const error = requireError(await getRejectedError(wait));

    expect(error.message).toBe(
      "Server initialization failed before HTTP listening:\n" +
        "session config failed before HTTP listen"
    );
    expect(error.cause).toBe(startupFailure);
    expect(httpServer.listenerCount("listening")).toBe(baselineListeningListeners);
    expect(httpServer.listenerCount("error")).toBe(baselineErrorListeners);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects HTTP errors and removes listeners and timeout", async () => {
    const httpServer = createServer();
    const startup = createDeferred();
    const httpError = new Error("listen failed");
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs
    });

    httpServer.emit("error", httpError);

    await expect(wait).rejects.toBe(httpError);
    expect(httpServer.listenerCount("listening")).toBe(baselineListeningListeners);
    expect(httpServer.listenerCount("error")).toBe(baselineErrorListeners);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out with HTTP state context and removes listeners", async () => {
    const httpServer = createServer();
    const startup = createDeferred();
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs
    });

    jest.advanceTimersByTime(timeoutMs);

    await expect(wait).rejects.toThrow(
      "Timed out after 2000ms waiting for test HTTP server to listen " +
        "(listening=false, address=null)"
    );
    expect(httpServer.listenerCount("listening")).toBe(baselineListeningListeners);
    expect(httpServer.listenerCount("error")).toBe(baselineErrorListeners);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("resolves on listening and preserves unrelated listeners", async () => {
    const httpServer = createServer();
    const startup = createDeferred();
    const unrelatedListening = jest.fn();
    const unrelatedError = jest.fn();
    httpServer.on("listening", unrelatedListening);
    httpServer.on("error", unrelatedError);
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs
    });

    httpServer.emit("listening");

    await expect(wait).resolves.toBeUndefined();
    expect(httpServer.listenerCount("listening")).toBe(baselineListeningListeners);
    expect(httpServer.listenerCount("error")).toBe(baselineErrorListeners);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("observes later init rejection after listening without replacing the init promise", async () => {
    jest.useRealTimers();
    const httpServer = createServer();
    const startup = createDeferred();
    const unhandledReasons: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledReasons.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      const wait = waitForHttpListeningOrStartupFailure({
        httpServer,
        initPromise: startup.promise,
        timeoutMs
      });

      httpServer.emit("listening");
      await expect(wait).resolves.toBeUndefined();

      const laterStartupFailure = new Error("startup failed after HTTP listen");
      startup.reject(laterStartupFailure);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      expect(unhandledReasons).toEqual([]);
      await expect(startup.promise).rejects.toBe(laterStartupFailure);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
});
