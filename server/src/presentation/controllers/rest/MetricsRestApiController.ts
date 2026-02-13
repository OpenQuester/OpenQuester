import { timingSafeEqual } from "crypto";
import { Router, type Express, type Request, type Response } from "express";

import { HttpStatus } from "domain/enums/HttpStatus";
import { type Environment } from "infrastructure/config/Environment";
import { MetricsService } from "infrastructure/services/metrics/MetricsService";
import { CryptoUtils } from "infrastructure/utils/CryptoUtils";

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
  private readonly _metricsTokenHash: Buffer | null;

  constructor(
    private readonly app: Express,
    private readonly metricsService: MetricsService,
    env: Environment
  ) {
    const router = Router();
    this._metricsTokenHash = env.METRICS_TOKEN
      ? CryptoUtils.sha256(env.METRICS_TOKEN)
      : null;

    this.app.use("/metrics", router);
    router.get("/", this._getMetrics);
  }

  private _getMetrics = async (req: Request, res: Response): Promise<void> => {
    if (!this._isAuthorized(req)) {
      res.status(HttpStatus.FORBIDDEN).json({ error: "Forbidden" });
      return;
    }

    res.set("Content-Type", this.metricsService.contentType);
    res.end(await this.metricsService.getMetrics());
  };

  /**
   * Validates the bearer token from the Authorization header.
   * If METRICS_TOKEN is not configured, access is unrestricted (dev convenience).
   */
  private _isAuthorized(req: Request): boolean {
    if (!this._metricsTokenHash) {
      return true;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return false;
    }

    const providedToken = authHeader.slice(7);

    // Comparing digests still gives constant-time semantics for the equality
    // check, while avoiding length-mismatch exceptions and unnecessary throw-paths
    return timingSafeEqual(
      CryptoUtils.sha256(providedToken),
      this._metricsTokenHash
    );
  }
}
