import { timingSafeEqual } from "crypto";
import http from "http";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";
import { singleton } from "tsyringe";

import { type ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { CryptoUtils } from "infrastructure/utils/CryptoUtils";

const METRICS_PREFIX = LogPrefix.METRICS;

/**
 * Singleton service for Prometheus metrics collection.
 * Provides HTTP and Socket.IO request tracking (RPS, latency) and curated default Node.js metrics.
 *
 * In production (PM2 cluster mode), each instance runs a dedicated lightweight
 * HTTP server on a unique port so Prometheus can scrape each instance independently.
 */
@singleton()
export class MetricsService {
  private readonly _registry: Registry;
  private _metricsServer: http.Server | null = null;

  // HTTP metrics
  private readonly _httpRequestsTotal: Counter;
  private readonly _httpRequestDuration: Histogram;

  // Socket.IO metrics
  private readonly _socketEventsTotal: Counter;
  private readonly _socketEventDuration: Histogram;

  constructor() {
    this._registry = new Registry();

    // Collect default Node.js metrics (CPU, memory, event loop, GC, etc.)
    collectDefaultMetrics({ register: this._registry });

    // Remove useless/noisy default metrics
    this._removeUnwantedMetrics();

    // HTTP Request Counter - for RPS calculation via rate()
    this._httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [this._registry],
    });

    // HTTP Request Duration Histogram - for latency percentiles
    this._httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      // Buckets optimized for API response times (1ms to 10s)
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this._registry],
    });

    // Socket.IO Event Counter - for RPS calculation via rate()
    this._socketEventsTotal = new Counter({
      name: "socket_events_total",
      help: "Total number of Socket.IO events processed",
      labelNames: ["event", "status"],
      registers: [this._registry],
    });

    // Socket.IO Event Duration Histogram - for latency percentiles
    this._socketEventDuration = new Histogram({
      name: "socket_event_duration_seconds",
      help: "Socket.IO event processing duration in seconds",
      labelNames: ["event", "status"],
      // Buckets optimized for socket event processing (1ms to 30s for long game actions)
      buckets: [
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
      ],
      registers: [this._registry],
    });
  }

  public get httpRequestsTotal(): Counter {
    return this._httpRequestsTotal;
  }

  public get httpRequestDuration(): Histogram {
    return this._httpRequestDuration;
  }

  public get socketEventsTotal(): Counter {
    return this._socketEventsTotal;
  }

  public get socketEventDuration(): Histogram {
    return this._socketEventDuration;
  }

  /**
   * Get all metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    return this._registry.metrics();
  }

  /**
   * Get content type for metrics response
   */
  public get contentType(): string {
    return this._registry.contentType;
  }

  /**
   * Start a dedicated lightweight HTTP server for Prometheus scraping.
   * Each PM2 instance runs this on a unique port (METRICS_PORT + NODE_APP_INSTANCE).
   * This avoids the PM2 cluster mode problem where scraping the shared API port
   * hits a random instance each time, breaking counter-based rate() calculations.
   */
  public startServer(port: number, token: string, logger: ILogger): void {
    const tokenHash = token ? CryptoUtils.sha256(token) : null;

    this._metricsServer = http.createServer(async (req, res) => {
      if (req.method !== "GET" || req.url !== "/metrics") {
        res.writeHead(404);
        res.end();
        return;
      }

      if (tokenHash) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }

        const providedToken = authHeader.slice(7);
        const providedTokenHash = CryptoUtils.sha256(providedToken);
        if (!timingSafeEqual(providedTokenHash, tokenHash)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }
      }

      const metrics = await this._registry.metrics();
      res.writeHead(200, { "Content-Type": this._registry.contentType });
      res.end(metrics);
    });

    this._metricsServer.once("error", (error) => {
      logger.error("Failed to start metrics server", {
        prefix: METRICS_PREFIX,
        port,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this._metricsServer.listen(port, () => {
      logger.info(`Metrics server listening on port: ${port}`, {
        prefix: METRICS_PREFIX,
        port,
      });
    });
  }

  /**
   * Stop the dedicated metrics HTTP server (for graceful shutdown).
   */
  public async stopServer(): Promise<void> {
    if (!this._metricsServer) {
      return;
    }

    return new Promise((resolve) => {
      this._metricsServer!.close(() => {
        this._metricsServer = null;
        resolve();
      });
    });
  }

  /**
   * Remove metrics that provide little operational value:
   * - nodejs_version_info: Static, doesn't change
   * - process_start_time_seconds: Static, uptime can be derived if needed
   * - process_open_fds: Rarely actionable
   * - nodejs_external_memory_bytes: Minimal value for most apps
   */
  private _removeUnwantedMetrics(): void {
    const metricsToRemove = [
      "nodejs_version_info",
      "process_start_time_seconds",
      "process_open_fds",
      "nodejs_external_memory_bytes",
    ];

    for (const metricName of metricsToRemove) {
      this._registry.removeSingleMetric(metricName);
    }
  }
}
