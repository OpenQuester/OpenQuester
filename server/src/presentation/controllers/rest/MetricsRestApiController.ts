import { Router, type Express, type Request, type Response } from "express";

import { HttpStatus } from "domain/enums/HttpStatus";
import { type Environment } from "infrastructure/config/Environment";
import { MetricsService } from "infrastructure/services/metrics/MetricsService";

/**
 * Exposes Prometheus-compatible metrics endpoint for monitoring.
 * Delegates to MetricsService for metrics collection including:
 * - HTTP request metrics (RPS, latency, active connections)
 * - Curated Node.js runtime metrics (CPU, memory, event loop, GC)
 *
 * Optionally secured with a bearer token (METRICS_TOKEN env var).
 * When the token is configured, Prometheus must include it in the Authorization header.
 */
export class MetricsRestApiController {
  private readonly _metricsService: MetricsService;
  private readonly _metricsToken: string;

  constructor(
    private readonly app: Express,
    env: Environment
  ) {
    const router = Router();
    this._metricsService = MetricsService.getInstance();
    this._metricsToken = env.METRICS_TOKEN;

    this.app.use("/metrics", router);
    router.get("/", this._getMetrics);
  }

  private _getMetrics = async (req: Request, res: Response): Promise<void> => {
    if (!this._isAuthorized(req)) {
      res.status(HttpStatus.FORBIDDEN).json({ error: "Forbidden" });
      return;
    }

    res.set("Content-Type", this._metricsService.contentType);
    res.end(await this._metricsService.getMetrics());
  };

  /**
   * Validates the bearer token from the Authorization header.
   * If METRICS_TOKEN is not configured, access is unrestricted (dev convenience).
   */
  private _isAuthorized(req: Request): boolean {
    if (!this._metricsToken) {
      return true;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return false;
    }

    return authHeader.slice(7) === this._metricsToken;
  }
}
