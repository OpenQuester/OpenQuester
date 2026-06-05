import os from "os";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { MetricsBuffer } from "application/services/metrics/MetricsBuffer";
import { SystemMetricsCollector } from "application/services/metrics/SystemMetricsCollector";
import { metricFloat, metricInteger } from "shared/metrics/MetricPoint";
import { type MetricsWriter } from "shared/metrics/MetricsWriter";

const METRICS_PREFIX = LogPrefix.INFLUXDB;

const SHUTDOWN_TIMEOUT_MS = 5000;

interface MetricsServiceStartConfig {
  url: string;
}

interface HttpRequestLabels {
  method: string;
  route: string;
  statusCode: string;
}

interface SocketEventLabels {
  event: string;
  status: "success" | "error";
}

/**
 * Singleton service for InfluxDB-based metrics collection.
 *
 * Runs in no-op mode when InfluxDB URL is not configured.
 * Metrics failures are isolated and never interrupt the application lifecycle.
 */
@singleton()
export class MetricsService {
  private readonly _instanceTag: string;

  constructor(
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger,
    @inject(DI_TOKENS.Environment) private readonly _env: Environment,
    @inject(DI_TOKENS.MetricsWriter) private readonly _metricsWriter: MetricsWriter,
    private readonly _buffer: MetricsBuffer,
    private readonly _systemCollector: SystemMetricsCollector
  ) {
    this._instanceTag = os.hostname();
  }

  /**
   * Returns `true` when metrics are actively configured and running.
   */
  public get isRunning(): boolean {
    return this._buffer.isRunning;
  }

  /**
   * Starts metrics collection and push delivery to InfluxDB.
   *
   * When `INFLUX_URL` is empty, the service runs in no-op mode.
   */
  public start(): void {
    const config: MetricsServiceStartConfig = {
      url: this._env.INFLUX_URL
    };

    if (!config.url?.trim()) {
      this.logger.info("InfluxDB URL is not configured, metrics are disabled", {
        prefix: METRICS_PREFIX
      });
      return;
    }

    const validation = this._validateInfluxUrl(config.url);
    if (!validation.valid) {
      this.logger.warn(validation.reason ?? "INFLUX_URL validation failed", {
        prefix: METRICS_PREFIX
      });
      return;
    }

    if (this.isRunning) {
      this.logger.warn("Metrics service is already started", {
        prefix: METRICS_PREFIX
      });
      return;
    }

    void this._startInternal(config);
  }

  private async _startInternal(config: MetricsServiceStartConfig): Promise<void> {
    await this._metricsWriter.configure({
      url: config.url
    });

    if (!this._metricsWriter.isReady) {
      this.logger.error("Failed to initialize InfluxDB metrics service", {
        prefix: METRICS_PREFIX
      });
      return;
    }

    this._buffer.start();
    this._systemCollector.start();

    this.logger.info("InfluxDB metrics service started", {
      prefix: METRICS_PREFIX,
      endpoint: this._sanitizeUrlForLogs(config.url),
      instance: this._instanceTag
    });

    void this._performHealthCheck();
  }

  /**
   * Stops metrics collection and flushes buffered points.
   *
   * This method is resilient and never throws.
   */
  public async stop(): Promise<void> {
    this._systemCollector.stop();

    if (!this._buffer.isRunning) {
      await this._metricsWriter.close();
      return;
    }

    try {
      await Promise.race([
        this._buffer.close(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
        })
      ]);
    } catch {
      // Ignore metrics shutdown failures
    } finally {
      await this._metricsWriter.close();
    }
  }

  /**
   * Records a single HTTP request event.
   *
   * No-op when metrics are disabled or not initialized.
   */
  public recordHttpRequest(labels: HttpRequestLabels, durationSeconds: number): void {
    if (!this._buffer.isRunning) {
      return;
    }

    try {
      const point = {
        measurement: "http_requests",
        tags: {
          method: labels.method,
          route: labels.route,
          status_code: labels.statusCode,
          instance: this._instanceTag
        },
        fields: {
          duration: metricFloat(durationSeconds),
          count: metricInteger(1)
        }
      };

      this._buffer.add(point);
    } catch {
      // Metrics failures are intentionally isolated
    }
  }

  /**
   * Records a single Socket.IO event.
   *
   * No-op when metrics are disabled or not initialized.
   */
  public recordSocketEvent(labels: SocketEventLabels, durationSeconds: number): void {
    if (!this._buffer.isRunning) {
      return;
    }

    try {
      const point = {
        measurement: "socket_events",
        tags: {
          event: labels.event,
          status: labels.status,
          instance: this._instanceTag
        },
        fields: {
          duration: metricFloat(durationSeconds),
          count: metricInteger(1)
        }
      };

      this._buffer.add(point);
    } catch {
      // Metrics failures are intentionally isolated
    }
  }

  private async _performHealthCheck(): Promise<void> {
    if (!this._metricsWriter.isReady) {
      return;
    }

    try {
      const version = await this._metricsWriter.getServerVersion();
      this.logger.info("InfluxDB connection check successful", {
        prefix: METRICS_PREFIX,
        version
      });
    } catch (error) {
      this.logger.warn("InfluxDB is currently unreachable, running degraded", {
        prefix: METRICS_PREFIX,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private _validateInfluxUrl(url: string): {
    valid: boolean;
    reason?: string;
  } {
    try {
      const parsed = new URL(url);
      const database =
        parsed.searchParams.get("database")?.trim() ?? parsed.searchParams.get("bucket")?.trim();

      if (!database) {
        return {
          valid: false,
          reason: "INFLUX_URL is missing required database query parameter, metrics are disabled"
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        reason: "INFLUX_URL is invalid, metrics are disabled"
      };
    }
  }

  private _sanitizeUrlForLogs(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return "invalid-url";
    }
  }
}
