import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type MetricPoint } from "shared/metrics/MetricPoint";
import { type MetricsWriter } from "shared/metrics/MetricsWriter";

const METRICS_PREFIX = LogPrefix.INFLUXDB;

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_HARD_CAP = 10000;

interface MetricsBufferOptions {
  maxSize?: number;
  flushIntervalMs?: number;
}

/**
 * Buffers metric points and flushes them to InfluxDB in batches.
 *
 * Write failures are isolated and never thrown to callers.
 */
@singleton()
export class MetricsBuffer {
  private readonly _buffer: MetricPoint[] = [];
  private _flushTimer: NodeJS.Timeout | null = null;
  private _maxSize: number = DEFAULT_MAX_SIZE;
  private _hardCap: number = DEFAULT_HARD_CAP;

  private _isFlushing = false;
  private _isRunning = false;
  private _flushRequested = false;

  constructor(
    @inject(DI_TOKENS.MetricsWriter) private readonly _metricsWriter: MetricsWriter,
    @inject(DI_TOKENS.Logger) private readonly _logger: ILogger
  ) {
    //
  }

  /**
   * Returns true when the buffer timer is active.
   */
  public get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Starts periodic flushing and configures buffer thresholds.
   */
  public start(options: MetricsBufferOptions = {}): void {
    if (this._isRunning) {
      return;
    }

    this._maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this._hardCap = Math.max(this._maxSize * 2, DEFAULT_HARD_CAP);

    const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this._flushTimer = setInterval(() => {
      void this.flush();
    }, flushIntervalMs);

    this._isRunning = true;
  }

  /**
   * Adds a point to the write buffer.
   *
   * If the buffer reaches max size, a flush is triggered asynchronously.
   */
  public add(point: MetricPoint): void {
    if (!this._isRunning || !this._metricsWriter.isReady) {
      return;
    }

    this._buffer.push(point);
    this._trimOverflow();

    if (this._buffer.length >= this._maxSize) {
      void this.flush();
    }
  }

  /**
   * Flushes all currently buffered points to InfluxDB.
   *
   * Errors are logged and not thrown.
   */
  public async flush(): Promise<void> {
    if (!this._isRunning || !this._metricsWriter.isReady) {
      return;
    }

    if (this._isFlushing) {
      this._flushRequested = true;
      return;
    }

    if (this._buffer.length === 0) {
      return;
    }

    const points = this._buffer.splice(0, this._buffer.length);
    this._isFlushing = true;

    try {
      await this._metricsWriter.write(points);
    } catch (error) {
      this._buffer.unshift(...points);
      this._trimOverflow();

      this._logger.error("Failed to flush metrics to InfluxDB", {
        prefix: METRICS_PREFIX,
        pointsCount: points.length,
        bufferedPoints: this._buffer.length,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this._isFlushing = false;
    }

    if (this._flushRequested) {
      this._flushRequested = false;
      await this.flush();
    }
  }

  /**
   * Stops periodic flushing and performs a final flush.
   */
  public async close(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }

    try {
      if (this._buffer.length > 0) {
        await this._metricsWriter.write(this._buffer.splice(0, this._buffer.length));
      }
    } catch (error) {
      this._logger.error("Failed to flush metrics buffer during close", {
        prefix: METRICS_PREFIX,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private _trimOverflow(): void {
    if (this._buffer.length <= this._hardCap) {
      return;
    }

    const dropped = this._buffer.length - this._hardCap;
    this._buffer.splice(0, dropped);

    this._logger.warn("Metrics buffer overflow, dropping oldest points", {
      prefix: METRICS_PREFIX,
      droppedPoints: dropped,
      hardCap: this._hardCap
    });
  }
}
