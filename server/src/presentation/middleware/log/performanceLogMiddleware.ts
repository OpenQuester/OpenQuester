import { NextFunction, Request, Response } from "express";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Performance logging middleware to track request timing and performance metrics
 */
export const performanceLogMiddleware =
  (logger: ILogger) => (req: Request, res: Response, next: NextFunction) => {
    const log = logger.performance(`API request`, {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get("User-Agent"),
      clientIp: req.ip,
      userId: req.session?.userId,
    });

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
      // Log performance metrics
      log.finish({
        statusCode: res.statusCode,
        contentLength: res.get("content-length") || 0,
      });

      // Call original end
      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
