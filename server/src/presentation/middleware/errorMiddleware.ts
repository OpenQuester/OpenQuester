import { type NextFunction, type Request, type Response } from "express";

import { BaseError } from "domain/errors/BaseError";
import { ErrorController } from "domain/errors/ErrorController";
import { type ILogger } from "infrastructure/logger/ILogger";

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
      logger.error(`Error middleware hit without error: ${err}`);
      return next();
    }
  };
