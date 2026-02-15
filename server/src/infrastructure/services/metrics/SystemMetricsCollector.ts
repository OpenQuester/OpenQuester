import { Point } from "@influxdata/influxdb3-client";
import os from "os";
import { type Namespace } from "socket.io";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GAME_INDEX_CREATED_AT_KEY } from "domain/constants/game";
import { MetricsBuffer } from "infrastructure/services/metrics/MetricsBuffer";
import { RedisService } from "infrastructure/services/redis/RedisService";

const DEFAULT_INTERVAL_MS = 15000;
const LAG_SAMPLE_INTERVAL_MS = 500;

export interface SystemMetricsCollectorOptions {
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
    @inject(DI_TOKENS.IOGameNamespace) private readonly _gamesNsp: Namespace,
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
      const elapsedMicroseconds = Math.max(
        (now - this._previousTimestamp) * 1000,
        1
      );

      const cpuUserDelta = currentCpuUsage.user - this._previousCpuUsage.user;
      const cpuSystemDelta =
        currentCpuUsage.system - this._previousCpuUsage.system;

      this._previousCpuUsage = currentCpuUsage;
      this._previousTimestamp = now;

      const memory = process.memoryUsage();

      // Average the lag samples collected since the last flush.
      const samples = this._eventLoopLagSamples;
      this._eventLoopLagSamples = [];
      const eventLoopLagSeconds =
        samples.length > 0
          ? samples.reduce((sum, v) => sum + v, 0) / samples.length
          : 0;

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

      const point = Point.measurement("system_metrics")
        .setTag("instance", this._instanceTag)
        .setFloatField(
          "cpu_user_pct",
          (cpuUserDelta / elapsedMicroseconds) * 100
        )
        .setFloatField(
          "cpu_system_pct",
          (cpuSystemDelta / elapsedMicroseconds) * 100
        )
        .setIntegerField("rss_bytes", memory.rss)
        .setIntegerField("heap_used_bytes", memory.heapUsed)
        .setIntegerField("heap_total_bytes", memory.heapTotal)
        .setFloatField("event_loop_lag_seconds", eventLoopLagSeconds)
        .setIntegerField("active_handles", activeHandles)
        .setIntegerField("active_requests", activeRequests)
        .setIntegerField("online_sockets", this._gamesNsp.sockets.size)
        .setIntegerField("active_games", activeGames);

      this._buffer.add(point);
    } catch {
      // System metrics collection must never throw into app execution.
    }
  }
}
