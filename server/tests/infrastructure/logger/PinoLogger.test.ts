import { describe, expect, it, jest } from "@jest/globals";
import { EventEmitter } from "events";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

class FakeLogStream extends EventEmitter {
  public readonly destroyed = false;
  public readonly closed = false;
  public readonly end: jest.Mock<() => void>;

  public constructor(onEnd: (stream: FakeLogStream) => void) {
    super();
    this.end = jest.fn(() => onEnd(this));
  }
}

interface PinoLoggerInternals {
  closeStream(stream: FakeLogStream, waitForClose?: boolean): Promise<void>;
}

describe("PinoLogger stream close", () => {
  it.each(["terminal", "file"])(
    "waits for every stream after a %s stream fails and retains all failures",
    async (failingDestination) => {
      const firstError = new Error("first stream failed");
      const secondError = new Error("second stream failed");
      const failingStream = new FakeLogStream((stream) => stream.emit("error", firstError));
      const delayedStream = new FakeLogStream(() => undefined);
      const lastStream = new FakeLogStream(() => undefined);
      const logger = createLogger(
        failingDestination === "terminal" ? failingStream : delayedStream,
        [failingDestination === "file" ? failingStream : delayedStream, lastStream]
      );
      const settled = jest.fn();
      const closing = logger.close();
      void closing.then(settled, settled);

      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).not.toHaveBeenCalled();
      expect(delayedStream.end).toHaveBeenCalledTimes(1);
      expect(lastStream.end).toHaveBeenCalledTimes(1);

      delayedStream.emit("error", secondError);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).not.toHaveBeenCalled();

      lastStream.emit("close");
      await expect(closing).rejects.toMatchObject({
        errors:
          failingDestination === "terminal" ? [firstError, secondError] : [secondError, firstError]
      });
      for (const stream of [failingStream, delayedStream, lastStream]) {
        expectSettlementListenersRemoved(stream);
      }
    }
  );

  it("waits for successful terminal and file closes before resolving", async () => {
    const terminal = new FakeLogStream(() => undefined);
    const file = new FakeLogStream(() => undefined);
    const logger = createLogger(terminal, [file]);
    const settled = jest.fn();
    const closing = logger.close();
    void closing.then(settled, settled);

    terminal.emit("close");
    file.emit("finish");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).not.toHaveBeenCalled();

    file.emit("close");
    await expect(closing).resolves.toBeUndefined();
    expectSettlementListenersRemoved(terminal);
    expectSettlementListenersRemoved(file);
  });

  it("rejects a stream error and removes every settlement listener", async () => {
    const streamError = new Error("stream flush failed");
    const stream = new FakeLogStream((currentStream) => {
      currentStream.emit("error", streamError);
      currentStream.emit("close");
    });

    await expect(closeStream(stream)).rejects.toBe(streamError);

    expect(stream.end).toHaveBeenCalledTimes(1);
    expectSettlementListenersRemoved(stream);
  });

  it("resolves a successful close exactly once and removes every listener", async () => {
    const stream = new FakeLogStream((currentStream) => {
      currentStream.emit("close");
      currentStream.emit("finish");
    });

    await expect(closeStream(stream, false)).resolves.toBeUndefined();

    expect(stream.end).toHaveBeenCalledTimes(1);
    expectSettlementListenersRemoved(stream);
  });
});

function createLogger(terminalStream: FakeLogStream, fileStreams: FakeLogStream[]): PinoLogger {
  return Object.assign(Object.create(PinoLogger.prototype) as PinoLogger, {
    terminalStream,
    fileStreams,
    loggers: new Map(),
    closed: false
  });
}

function closeStream(stream: FakeLogStream, waitForClose = true): Promise<void> {
  const logger = Object.create(PinoLogger.prototype) as PinoLogger;
  return (logger as unknown as PinoLoggerInternals).closeStream(stream, waitForClose);
}

function expectSettlementListenersRemoved(stream: FakeLogStream): void {
  expect(stream.listenerCount("close")).toBe(0);
  expect(stream.listenerCount("finish")).toBe(0);
  expect(stream.listenerCount("error")).toBe(0);
}
