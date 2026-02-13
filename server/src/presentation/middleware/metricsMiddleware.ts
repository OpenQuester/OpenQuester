import { NextFunction, Request, Response } from "express";

import { MetricsService } from "infrastructure/services/metrics/MetricsService";

/**
 * Middleware for collecting HTTP request metrics for Prometheus.
 * Tracks: request count (for RPS), request duration (latency).
 */
export const metricsMiddleware = () => {
  const metricsService = MetricsService.getInstance();

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip metrics endpoint to avoid self-referential data
    if (req.path === "/metrics") {
      return next();
    }

    // Start timing
    const endTimer = metricsService.httpRequestDuration.startTimer();

    // Capture metrics on response finish
    res.on("finish", () => {
      const route = normalizeRoute(req);
      const labels = {
        method: req.method,
        route,
        status_code: res.statusCode.toString(),
      };

      // Record request count (for RPS calculation)
      metricsService.httpRequestsTotal.inc(labels);

      // Record request duration
      endTimer(labels);
    });

    next();
  };
};

/**
 * Normalize route path to avoid high-cardinality labels.
 * Replaces dynamic segments (UUIDs, numbers) with placeholders.
 */
function normalizeRoute(req: Request): string {
  // Use matched route if available (from Express router)
  if (req.route?.path) {
    return req.baseUrl + req.route.path;
  }

  // Fallback: normalize the path manually
  let path = req.path;

  // Replace UUIDs (v4 format)
  path = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ":id"
  );

  // Replace numeric IDs
  path = path.replace(/\/\d+(?=\/|$)/g, "/:id");

  // Replace long alphanumeric strings (likely IDs)
  path = path.replace(/\/[a-zA-Z0-9]{20,}(?=\/|$)/g, "/:id");

  return path;
}
