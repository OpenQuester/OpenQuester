import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createServer } from "http";

import { waitForHttpListeningOrStartupFailure } from "tests/e2e/harness/HttpTestWait";
import {
  createControlledPromise,
  getRejectedError,
  requireError
} from "tests/e2e/harness/TestPromiseUtils";

const httpListenTimeoutMs = 2000;

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
    const startup = createControlledPromise();
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
      timeoutMs: httpListenTimeoutMs
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
    const startup = createControlledPromise();
    const httpError = new Error("listen failed");
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs: httpListenTimeoutMs
    });

    httpServer.emit("error", httpError);

    await expect(wait).rejects.toBe(httpError);
    expect(httpServer.listenerCount("listening")).toBe(baselineListeningListeners);
    expect(httpServer.listenerCount("error")).toBe(baselineErrorListeners);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out with HTTP state context and removes listeners", async () => {
    const httpServer = createServer();
    const startup = createControlledPromise();
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs: httpListenTimeoutMs
    });

    jest.advanceTimersByTime(httpListenTimeoutMs);

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
    const startup = createControlledPromise();
    const unrelatedListening = jest.fn();
    const unrelatedError = jest.fn();
    httpServer.on("listening", unrelatedListening);
    httpServer.on("error", unrelatedError);
    const baselineListeningListeners = httpServer.listenerCount("listening");
    const baselineErrorListeners = httpServer.listenerCount("error");

    const wait = waitForHttpListeningOrStartupFailure({
      httpServer,
      initPromise: startup.promise,
      timeoutMs: httpListenTimeoutMs
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
    const startup = createControlledPromise();
    const unhandledReasons: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledReasons.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      const wait = waitForHttpListeningOrStartupFailure({
        httpServer,
        initPromise: startup.promise,
        timeoutMs: httpListenTimeoutMs
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
