import { NextFunction, Request, Response } from "express";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Performance logging middleware to track request timing and performance metrics
 */
export const performanceLogMiddleware =
  (logger: ILogger) => (req: Request, res: Response, next: NextFunction) => {
    // Decode percent-encoded (e.g. Cyrillic) characters for readability; keep raw
    const rawUrl = req.originalUrl;
    let decodedUrl = rawUrl;
    try {
      decodedUrl = decodeURI(rawUrl);
    } catch {
      // Fallback silently if malformed encoding
    }

    const log = logger.performance(`API request`, {
      method: req.method,
      url: decodedUrl,
      rawUrl,
      userAgent: req.get("User-Agent"),
      clientIp: req.ip,
      userId: req.session?.userId,
    });

    // Log request start
    logger.trace(`Request started: ${req.method} ${decodedUrl}`, {
      prefix: "[PERF]: ",
      method: req.method,
      url: decodedUrl,
      rawUrl,
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
