import { type NextFunction, type Request, type Response } from "express";

import { MetricsService } from "infrastructure/services/metrics/MetricsService";

/**
 * Middleware for recording HTTP request metrics to InfluxDB.
 */
export const metricsMiddleware = (metricsService: MetricsService) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.once("finish", () => {
      const route = normalizeRoute(req);
      const durationSeconds = (Date.now() - startTime) / 1000;

      metricsService.recordHttpRequest(
        {
          method: req.method,
          route,
          statusCode: res.statusCode.toString(),
        },
        durationSeconds
      );
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

  return req.baseUrl + normalizedSegments;
}
