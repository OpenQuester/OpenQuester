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

function closeStream(stream: FakeLogStream, waitForClose = true): Promise<void> {
  const logger = Object.create(PinoLogger.prototype) as PinoLogger;
  return (logger as unknown as PinoLoggerInternals).closeStream(stream, waitForClose);
}

function expectSettlementListenersRemoved(stream: FakeLogStream): void {
  expect(stream.listenerCount("close")).toBe(0);
  expect(stream.listenerCount("finish")).toBe(0);
  expect(stream.listenerCount("error")).toBe(0);
}
