import { NextFunction, Request, Response } from "express";

import {
  LogContextService,
  RequestContext,
} from "infrastructure/logger/LogContext";
import { LogTag } from "infrastructure/logger/LogTag";

/**
 * HTTP middleware that establishes request context with correlation ID.
 * All logs within the request lifecycle will automatically include this ID.
 *
 * ## Security Note
 *
 * We do NOT accept correlation IDs from clients. Reasons:
 * 1. **Log injection**: Malicious clients could send crafted IDs to pollute logs
 * 2. **Correlation spoofing**: Attackers could link their requests to legitimate user sessions
 * 3. **DoS via log bloat**: Extremely long IDs could bloat log storage
 *
 * For internal service-to-service tracing (e.g., microservices), accept headers only
 * from trusted upstream services via a separate trusted proxy middleware.
 */
export const correlationMiddleware =
  () =>
  (req: Request, res: Response, next: NextFunction): void => {
    // Always generate fresh correlation ID - never trust client-provided values
    const context: RequestContext = LogContextService.createContext({
      userId: req.session?.userId,
      tags: new Set([LogTag.HTTP]),
    });

    // Expose correlation ID on request and response for debugging
    req.correlationId = context.correlationId;
    res.setHeader("x-correlation-id", context.correlationId);

    // Run entire request within context - all logs will include correlationId
    LogContextService.run(context, () => {
      next();
    });
  };
