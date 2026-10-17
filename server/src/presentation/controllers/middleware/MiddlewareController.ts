import { RedisStore } from "connect-redis";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import Redis from "ioredis";

import { ApiContext } from "shared/context/ApiContext";
import { ClientError } from "domain/errors/ClientError";
import { EnvType } from "shared/config/Environment";
import { LogPrefix } from "shared/logging/LogPrefix";
import { verifySession } from "presentation/middleware/authMiddleware";
import { correlationMiddleware } from "presentation/middleware/correlationMiddleware";
import { performanceLogMiddleware } from "presentation/middleware/log/performanceLogMiddleware";
import { metricsMiddleware } from "presentation/middleware/metricsMiddleware";
import { MetricsService } from "application/services/metrics/MetricsService";

const CORS_PREFIX = LogPrefix.CORS;

export class MiddlewareController {
  private readonly allowedHosts: string[];
  private readonly allOriginsAllowed: boolean = false;

  constructor(
    private readonly ctx: ApiContext,
    private readonly redisClient: Redis,
    private readonly metricsService: MetricsService
  ) {
    this.allowedHosts = this.ctx.env.CORS_ORIGINS;

    ctx.logger.info(`Allowed CORS origins for current instance: [${this.allowedHosts}]`, {
      prefix: CORS_PREFIX
    });

    if (this.allowedHosts.some((host) => host === "*")) {
      this.allOriginsAllowed = true;
      ctx.logger.warn("Current instance's CORS allows all origins !!", {
        prefix: CORS_PREFIX
      });
    }
  }

  public async initialize() {
    this.ctx.app.use(express.json({ limit: "800kb" }));
    this.ctx.app.use(express.urlencoded({ limit: "800kb", extended: true }));

    // CSP for the API pages and the browser app served from this origin
    // (WebAppController): media and presigned uploads go to S3, Discord sign-in
    // exchanges its code with discord.com, avatars may come from Discord's CDN.
    // Uploads go to S3_ENDPOINT; public file links may use S3_URL_PREFIX instead.
    const s3 = [
      ...new Set(
        ["S3_ENDPOINT", "S3_URL_PREFIX"]
          .map((name) => this._origin(this.ctx.env.getEnvVar(name, "string", "", true)))
          .filter((origin): origin is string => origin != null)
      )
    ];

    this.ctx.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            // The web app compiles its AVIF encoder (WebAssembly) before upload.
            scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
            imgSrc: ["'self'", "data:", "blob:", "https://cdn.discordapp.com", ...s3],
            mediaSrc: ["'self'", "blob:", ...s3],
            connectSrc: ["'self'", "https://discord.com", ...s3],
            fontSrc: ["'self'", "https:", "data:"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            // Local stacks serve S3 over plain http.
            upgradeInsecureRequests: this.ctx.env.ENV === EnvType.PROD ? [] : null
          }
        }
      })
    );
    this.ctx.app.use(
      cors({
        credentials: true,
        origin: (origin, callback) => {
          if (this.allOriginsAllowed || !origin) {
            return callback(null, true);
          }

          try {
            const domain = new URL(origin).hostname;

            const isOriginAllowed = this.allowedHosts.some(
              (allowedHost) =>
                domain === allowedHost ||
                domain.endsWith(`.${allowedHost}`) ||
                origin === allowedHost
            );

            if (isOriginAllowed) {
              return callback(null, origin);
            }

            return callback(new ClientError(`CORS policy: Origin '${origin}' is not allowed`));
          } catch {
            return callback(new ClientError("CORS policy: Invalid origin provided"));
          }
        },
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
      })
    );
    this.ctx.app.disable("x-powered-by");

    // Correlation ID middleware - must be before performance logging
    this.ctx.app.use(correlationMiddleware());

    // Metrics middleware
    this.ctx.app.use(metricsMiddleware(this.metricsService));

    this.ctx.app.use(performanceLogMiddleware(this.ctx.logger));

    // Trust first proxy to enable secure cookies
    this.ctx.app.set("trust proxy", 1);

    const isProd = this.ctx.env.ENV === EnvType.PROD;
    // Session
    this.ctx.app.use(
      session({
        store: new RedisStore({ client: this.redisClient, prefix: "session:" }),
        secret: this.ctx.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: isProd,
          maxAge: this.ctx.env.SESSION_MAX_AGE,
          sameSite: isProd ? "none" : "lax",
          domain: this.ctx.env.API_DOMAIN
        }
      })
    );
    // The web app can be served under another host than API_DOMAIN (e.g.
    // dev.openquester.app beside dev-api.openquester.app). Browsers drop a cookie
    // scoped to a foreign domain, so use a host-only cookie on those hosts.
    this.ctx.app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.session?.cookie) {
        req.session.cookie.domain = this._cookieDomainFor(req.hostname);
      }

      next();
    });
    this.ctx.app.use(verifySession(this.ctx.env, this.ctx.logger));
  }

  private _cookieDomainFor(hostname: string): string | undefined {
    const domain = this.ctx.env.API_DOMAIN?.replace(/^\./, "");
    if (!domain) return undefined;

    const matches = hostname === domain || hostname.endsWith(`.${domain}`);

    return matches ? this.ctx.env.API_DOMAIN : undefined;
  }

  private _origin(url: string): string | null {
    try {
      return url ? new URL(url).origin : null;
    } catch {
      return null;
    }
  }
}
