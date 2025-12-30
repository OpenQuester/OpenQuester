import { type NextFunction, type Request, type Response } from "express";

import { BaseError } from "domain/errors/BaseError";
import { ErrorController } from "domain/errors/ErrorController";
import { type ILogger } from "infrastructure/logger/ILogger";

/**
 * Express error handling middleware - outermost error boundary for HTTP requests
 * 
 * Purpose: Answer "What HTTP request failed and why?"
 * Level: error (Transport layer boundary - request failures)
 * Cardinality: Safe - error codes and messages are bounded
 * Note: ErrorController.resolveError handles actual error logging
 */
export const errorMiddleware =
  (logger: ILogger) =>
  async (
    err: Error | BaseError,
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (err) {
      const { message, code } = await ErrorController.resolveError(err, logger);
      res.status(code).json({ error: message });
    } else {
      // This should never happen - indicates framework misconfiguration
      logger.error(`Error middleware invoked without error`, {
        prefix: "[ERROR_MIDDLEWARE]: ",
      });
      return next();
    }
  };
