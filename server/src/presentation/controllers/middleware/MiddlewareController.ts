import { RedisStore } from "connect-redis";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import Redis from "ioredis";

import { ApiContext } from "application/context/ApiContext";
import { ClientError } from "domain/errors/ClientError";
import { EnvType } from "infrastructure/config/Environment";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { verifySession } from "presentation/middleware/authMiddleware";
import { correlationMiddleware } from "presentation/middleware/correlationMiddleware";
import { performanceLogMiddleware } from "presentation/middleware/log/performanceLogMiddleware";

const CORS_PREFIX = LogPrefix.CORS;

export class MiddlewareController {
  private readonly allowedHosts: string[];
  private readonly allOriginsAllowed: boolean = false;

  constructor(
    private readonly ctx: ApiContext,
    private readonly redisClient: Redis
  ) {
    this.allowedHosts = this.ctx.env.CORS_ORIGINS;

    ctx.logger.info(
      `Allowed CORS origins for current instance: [${this.allowedHosts}]`,
      { prefix: CORS_PREFIX }
    );

    if (this.allowedHosts.some((host) => host === "*")) {
      this.allOriginsAllowed = true;
      ctx.logger.warn("Current instance's CORS allows all origins !!", {
        prefix: CORS_PREFIX,
      });
    }
  }

  public async initialize() {
    this.ctx.app.use(express.json({ limit: "800kb" }));
    this.ctx.app.use(express.urlencoded({ limit: "800kb", extended: true }));

    // Configure helmet with custom CSP to allow S3/MinIO images
    const s3Endpoint = this.ctx.env.getEnvVar(
      "S3_ENDPOINT",
      "string",
      "",
      true
    );
    const imgSrcDirectives = ["'self'", "data:"];
    if (s3Endpoint) {
      imgSrcDirectives.push(s3Endpoint);
    }

    this.ctx.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            imgSrc: imgSrcDirectives,
          },
        },
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

            return callback(
              new ClientError(`CORS policy: Origin '${origin}' is not allowed`)
            );
          } catch {
            return callback(
              new ClientError("CORS policy: Invalid origin provided")
            );
          }
        },
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    );
    this.ctx.app.disable("x-powered-by");

    // Correlation ID middleware - must be before performance logging
    this.ctx.app.use(correlationMiddleware());

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
          domain: this.ctx.env.API_DOMAIN,
        },
      })
    );
    this.ctx.app.use(verifySession(this.ctx.env, this.ctx.logger));
  }
}
