import { NextFunction, Request, Response } from "express";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Performance logging middleware to track request timing and performance metrics
 */
export const performanceLogMiddleware =
  (logger: ILogger) => (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Log request start
    logger.trace(`Request started: ${req.method} ${req.originalUrl}`, {
      prefix: "[PERF]: ",
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
      clientIp: req.ip,
      userId: req.session?.userId,
    });

    // Override res.end to capture response timing
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any, cb?: () => void) {
      const endTime = Date.now();
      const hrDiff = process.hrtime(startHrTime);
      const durationMs = endTime - startTime;
      const durationNs = hrDiff[0] * 1e9 + hrDiff[1];
      const durationMicroseconds = durationNs / 1000;

      // Log performance metrics
      logger.performance(
        `Request completed: ${req.method} ${req.originalUrl}`,
        {
          prefix: "[PERF]: ",
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
          durationMicroseconds,
          contentLength: res.get("content-length") || 0,
          userId: req.session?.userId,
          clientIp: req.ip,
          userAgent: req.get("User-Agent"),
          timestamp: new Date().toISOString(),
        }
      );

      // Log slow requests
      if (durationMs > 1000) {
        logger.warn(
          `Slow request detected: ${req.method} ${req.originalUrl} took ${durationMs}ms`,
          {
            prefix: "[PERF]: ",
            method: req.method,
            url: req.originalUrl,
            durationMs,
            statusCode: res.statusCode,
            userId: req.session?.userId,
          }
        );
      }

      // Log very slow requests
      if (durationMs > 5000) {
        logger.warn(
          `Very slow request: ${req.method} ${req.originalUrl} took ${durationMs}ms`,
          {
            prefix: "[PERF]: ",
            method: req.method,
            url: req.originalUrl,
            durationMs,
            statusCode: res.statusCode,
            userId: req.session?.userId,
            clientIp: req.ip || req.connection.remoteAddress,
          }
        );
      }

      // Call original end
      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
