import { NextFunction, Request, Response } from "express";

import { MetricsService } from "infrastructure/services/metrics/MetricsService";

/**
 * Middleware for collecting HTTP request metrics for Prometheus.
 * Tracks: request count (for RPS), request duration (latency).
 */
export const metricsMiddleware = (metricsService: MetricsService) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip metrics endpoint to avoid self-referential data
    if (req.path === "/metrics") {
      return next();
    }

    // Start timing
    const endTimer = metricsService.httpRequestDuration.startTimer();

    // Capture metrics on response finish
    res.once("finish", () => {
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

  // Fallback: normalize by full path segments only. This avoids accidental
  // partial matches (for example, preserving "v1" in "/api/v1/reset").
  const UUID_SEGMENT_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const NUMERIC_SEGMENT_REGEX = /^\d+$/;
  const LONG_ALNUM_SEGMENT_REGEX = /^[a-zA-Z0-9]{20,}$/;

  const normalizedSegments = req.path
    .split("/")
    .map((segment) => {
      if (
        UUID_SEGMENT_REGEX.test(segment) ||
        NUMERIC_SEGMENT_REGEX.test(segment) ||
        LONG_ALNUM_SEGMENT_REGEX.test(segment)
      ) {
        return ":id";
      }
      return segment;
    })
    .join("/");

  return normalizedSegments;
}
