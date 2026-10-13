import express, { type Express, type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/** Paths the app shell never answers; unknown ones there stay plain 404s. */
const API_PREFIXES = ["/v1", "/socket.io", "/health", "/assets"];

/**
 * Serves the browser client (web/dist) from the API's own origin, so the app,
 * its session cookie and the game socket share one host and need no CORS.
 * Enabled when WEB_APP_DIR points at a built web/dist (the Docker image sets it).
 */
export class WebAppController {
  constructor(app: Express, dir: string | undefined, logger: ILogger) {
    if (!dir) return;
    const root = path.resolve(dir);
    const index = path.join(root, "index.html");
    // Checked once at startup.
    // eslint-disable-next-line node/no-sync
    if (!fs.existsSync(index)) {
      logger.warn(`WEB_APP_DIR is set but ${index} is missing; web app not served`, {
        prefix: LogPrefix.SERVE_API
      });
      return;
    }

    // Hashed build output never changes under the same name.
    app.use(
      "/assets",
      express.static(path.join(root, "assets"), {
        immutable: true,
        maxAge: "1y"
      })
    );
    app.use(express.static(root, { index: false, maxAge: "1h" }));

    // Client-side routes (/games/ABCD, /packages/upload, …) all load the app shell.
    app.get(/.*/, (req: Request, res: Response, next: NextFunction) => {
      const isApi = API_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`));
      if (isApi || !req.accepts("html")) {
        return next();
      }
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(index);
    });

    logger.info(`Serving the web app from ${root}`, { prefix: LogPrefix.SERVE_API });
  }
}
