import { type NextFunction, type Request, type Response } from "express";

import { Environment } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export const logMiddleware =
  (env: Environment, logger: ILogger) =>
  async (req: Request, res: Response, next: NextFunction) => {
    // Capture the original send method to log the response body
    const originalSend = res.send;
    let isSent = false;

    res.send = function (body: any) {
      // TODO: Why double logging happens? Fix when solution found
      // Avoid double logging
      if (!isSent) {
        // Log the request path and arguments
        try {
          log(req, body, env, logger);
        } catch {
          // Avoid all unexpected errors, for example with JSON.stringify
        }
        isSent = true;
      }
      return originalSend.call(this, body);
    };

    next();
  };

function log(
  req: Request,
  responseBody: any,
  env: Environment,
  logger: ILogger
) {
  const level = env.LOG_LEVEL;

  if (logger.checkAccess(level, "debug")) {
    logger.debug(
      `[${req.session.userId ?? "GUEST"}] [${req.method}]: ${JSON.stringify(
        req.originalUrl
      )}`
    );

    if (logger.checkAccess(level, "trace")) {
      logger.debug(`Query parameters: ${format(req.query)}`);

      if (!ValueUtils.isEmpty(req.headers)) {
        logger.debug(`Request headers: ${JSON.stringify(req.headers)}`);
      }

      if (!ValueUtils.isEmpty(req.body)) {
        logger.debug(`Request body: ${format(req.body)}`);
      }

      logger.debug(`Response body: ${format(responseBody)}`);
      console.log("\n");
    }
  }
}

function format(value: unknown, maxLength = 500) {
  const str = JSON.stringify(value);

  if (str.length <= maxLength) return str;
  const ellipsis = "...";
  return str.substring(0, maxLength) + ellipsis;
}
