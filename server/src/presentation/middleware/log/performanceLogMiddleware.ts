import { NextFunction, Request, Response } from "express";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Performance logging middleware to track request timing and performance metrics
 * 
 * Purpose: Answer "How long did this HTTP request take and what was its outcome?"
 * Level: performance (Transport layer boundary - request/response metrics)
 * Cardinality: Safe - enum status codes, no unbounded fields
 */
export const performanceLogMiddleware =
  (logger: ILogger) => (req: Request, res: Response, next: NextFunction) => {
    // Decode percent-encoded (e.g. Cyrillic) characters for readability
    const rawUrl = req.originalUrl;
    let decodedUrl = rawUrl;
    try {
      decodedUrl = decodeURI(rawUrl);
    } catch {
      // Fallback silently if malformed encoding
    }

    const log = logger.performance(`HTTP request`, {
      method: req.method,
      url: decodedUrl,
      userId: req.session?.userId,
    });

    // Override res.end to capture response timing
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any, cb?: () => void) {
      // Log performance metrics
      log.finish({
        statusCode: res.statusCode,
      });

      // Call original end
      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
