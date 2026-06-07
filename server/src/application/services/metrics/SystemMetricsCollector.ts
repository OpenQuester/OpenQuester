import os from "os";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { GAME_INDEX_CREATED_AT_KEY } from "domain/constants/game";
import { MetricsBuffer } from "application/services/metrics/MetricsBuffer";
import { RedisService } from "application/services/redis/RedisService";
import { metricFloat, metricInteger } from "shared/metrics/MetricPoint";

const DEFAULT_INTERVAL_MS = 15000;
const LAG_SAMPLE_INTERVAL_MS = 500;

interface SystemMetricsCollectorOptions {
  intervalMs?: number;
}

/**
 * Collects process-level system metrics and writes them to the metrics buffer.
 *
 * Event loop lag is measured via setImmediate: a timer fires every 500ms,
 * records hrtime, then schedules setImmediate. The delay between the two
 * represents how long the event loop took to reach the check phase —
 * directly reflecting responsiveness under load.
 */
@singleton()
export class SystemMetricsCollector {
  private _collectionTimer: NodeJS.Timeout | null = null;
  private _lagSampleTimer: NodeJS.Timeout | null = null;
  private _previousCpuUsage: NodeJS.CpuUsage;
  private _previousTimestamp: number;
  private readonly _instanceTag: string;
  private _intervalMs: number = DEFAULT_INTERVAL_MS;

  /** Accumulated Event Loop lag samples (seconds) since last collection. */
  private _eventLoopLagSamples: number[] = [];

  constructor(
    private readonly _buffer: MetricsBuffer,
    @inject(DI_TOKENS.RealtimeGateway) private readonly _realtimeGateway: RealtimeGateway,
    private readonly _redisService: RedisService
  ) {
    this._previousCpuUsage = process.cpuUsage();
    this._previousTimestamp = Date.now();
    this._instanceTag = os.hostname();
  }

  /**
   * Starts periodic system metrics collection.
   */
  public start(options: SystemMetricsCollectorOptions = {}): void {
    if (this._collectionTimer) {
      return;
    }

    this._intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

    this._startEventLoopLagSampler();

    this._collectionTimer = setInterval(() => {
      void this._collect();
    }, this._intervalMs);
  }

  /**
   * Stops periodic collection.
   */
  public stop(): void {
    if (this._collectionTimer) {
      clearInterval(this._collectionTimer);
      this._collectionTimer = null;
    }

    if (this._lagSampleTimer) {
      clearInterval(this._lagSampleTimer);
      this._lagSampleTimer = null;
    }

    this._eventLoopLagSamples = [];
  }

  /**
   * Samples event loop lag via setImmediate at a fixed interval.
   * Each sample records the time between scheduling setImmediate and
   * its callback executing, which reflects event loop saturation.
   */
  private _startEventLoopLagSampler(): void {
    this._lagSampleTimer = setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lagNs = Number(process.hrtime.bigint() - start);
        this._eventLoopLagSamples.push(lagNs / 1e9);
      });
    }, LAG_SAMPLE_INTERVAL_MS);
  }

  private async _collect(): Promise<void> {
    try {
      const now = Date.now();
      const currentCpuUsage = process.cpuUsage();
      const elapsedMicroseconds = Math.max((now - this._previousTimestamp) * 1000, 1);

      const cpuUserDelta = currentCpuUsage.user - this._previousCpuUsage.user;
      const cpuSystemDelta = currentCpuUsage.system - this._previousCpuUsage.system;

      this._previousCpuUsage = currentCpuUsage;
      this._previousTimestamp = now;

      const memory = process.memoryUsage();

      // Average the lag samples collected since the last flush.
      const samples = this._eventLoopLagSamples;
      this._eventLoopLagSamples = [];
      const eventLoopLagSeconds =
        samples.length > 0 ? samples.reduce((sum, v) => sum + v, 0) / samples.length : 0;

      const processWithInternals = process as NodeJS.Process & {
        _getActiveHandles?: () => unknown[];
        _getActiveRequests?: () => unknown[];
      };

      const activeHandles = processWithInternals._getActiveHandles
        ? processWithInternals._getActiveHandles().length
        : 0;
      const activeRequests = processWithInternals._getActiveRequests
        ? processWithInternals._getActiveRequests().length
        : 0;

      const activeGames = await this._redisService.zcard(GAME_INDEX_CREATED_AT_KEY);

      const point = {
        measurement: "system_metrics",
        tags: {
          instance: this._instanceTag
        },
        fields: {
          cpu_user_pct: metricFloat((cpuUserDelta / elapsedMicroseconds) * 100),
          cpu_system_pct: metricFloat((cpuSystemDelta / elapsedMicroseconds) * 100),
          rss_bytes: metricInteger(memory.rss),
          heap_used_bytes: metricInteger(memory.heapUsed),
          heap_total_bytes: metricInteger(memory.heapTotal),
          event_loop_lag_seconds: metricFloat(eventLoopLagSeconds),
          active_handles: metricInteger(activeHandles),
          active_requests: metricInteger(activeRequests),
          online_sockets: metricInteger(this._realtimeGateway.getOnlineSocketCount()),
          active_games: metricInteger(activeGames)
        }
      };

      this._buffer.add(point);
    } catch {
      // System metrics collection must never throw into app execution.
    }
  }
}
