import dotenv from "dotenv";
import fs from "fs";
import type Redis from "ioredis";
import path from "path";
import { type LoggerOptions } from "typeorm";

import { SESSION_SECRET_REDIS_NSP } from "domain/constants/session";
import { ServerResponse } from "domain/enums/ServerResponse";
import { ServerError } from "domain/errors/ServerError";
import { EnvVar } from "domain/types/env/env";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { LogLevel } from "infrastructure/logger/PinoLogger";
import { SessionUtils } from "infrastructure/utils/SessionUtils";
import { TemplateUtils } from "infrastructure/utils/TemplateUtils";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export enum EnvType {
  DEV = "dev",
  PROD = "prod",
  TEST = "test",
}

const ENV_PREFIX = LogPrefix.ENV;

/**
 * Class of environment layer.
 * All `process.env` variables should be retrieved only trough this class.
 */
export class Environment {
  private _type!: EnvType;
  /** Used for singleton implementation */
  private static _instance: Environment | undefined = undefined;

  // URLs
  public API_DOMAIN!: string;
  public CORS_ORIGINS!: string[];

  // DB vars
  public DB_TYPE!: string;
  public DB_NAME!: string;
  public DB_USER!: string;
  public DB_PASS!: string;
  public DB_HOST!: string;
  public DB_PORT!: number;
  public DB_LOGGER!: LoggerOptions;

  // Redis
  public REDIS_USERNAME!: string;
  public REDIS_PASSWORD!: string;
  public REDIS_HOST!: string;
  public REDIS_PORT!: number;
  public REDIS_DB_NUMBER!: number;

  // Session
  public SESSION_SECRET!: string;
  public SESSION_MAX_AGE!: number;

  // Socket.IO
  public SOCKET_IO_ADMIN_UI_ENABLE!: boolean;
  public SOCKET_IO_ADMIN_UI_USERNAME!: string;
  public SOCKET_IO_ADMIN_UI_PASSWORD!: string;

  // Logs
  public LOG_LEVEL!: LogLevel;

  private constructor(private readonly logger: ILogger) {
    //
  }

  public static getInstance(logger: ILogger, opts?: { overwrite: boolean }) {
    if (!this._instance || opts?.overwrite) {
      this._instance = new Environment(logger);
    }

    return this._instance;
  }

  /** Get environment type */
  public get ENV(): string {
    return this._type;
  }

  /**
   * Load all environment variables, if not loaded already
   * @param force Specify if you want to load environment even if it's loaded already
   */
  public load(force: boolean = false): void {
    if (this._type && !force) {
      return;
    }

    // Ignore rule since this read executes only on initialization
    // It will be harder to handle DataSource with async env load
    // eslint-disable-next-line node/no-sync
    if (fs.existsSync(path.resolve(process.cwd(), ".env"))) {
      // Load variables from file only, if file exists
      // In other case variables should provided directly in environment e.g. `$ export VAR="value"`
      dotenv.config();
    }

    this.loadEnv();
  }

  /**
   * Get variable from `process.env` or return default value
   *
   * Performs type checking
   */
  public getEnvVar(
    variable: string,
    type: EnvVar | EnvVar[],
    defaultValue: unknown = undefined,
    optional: boolean = false
  ): any {
    let value = process.env[variable] ?? defaultValue;
    value = value === "undefined" ? undefined : value;

    const { success, resolvedType } = this._checkType(value, type);

    if (success) {
      switch (resolvedType) {
        case "boolean":
          return ValueUtils.parseBoolean(value);
        case "number":
          return Number(value);
        case "string":
          return String(value);
      }
    } else if (!optional) {
      throw new ServerError(
        TemplateUtils.text(ServerResponse.ENV_VAR_WRONG_TYPE, {
          var: variable,
          expectedType: String(type),
          value: String(value),
          type: typeof variable,
        })
      );
    }
  }

  /**
   * Load session configuration from Redis
   */
  public async loadSessionConfig(length: number, redisClient: Redis) {
    const secret = await redisClient.get(SESSION_SECRET_REDIS_NSP);
    if (secret) {
      this.SESSION_SECRET = secret;
    } else {
      this.logger.audit(`New session secret generated`, {
        prefix: ENV_PREFIX,
      });
      this.SESSION_SECRET = await SessionUtils.generateSecret(length);
      await redisClient.set(SESSION_SECRET_REDIS_NSP, this.SESSION_SECRET);
    }

    this.SESSION_MAX_AGE = this.getEnvVar(
      "SESSION_MAX_AGE",
      "number",
      24 * 30 * 24 * 60 * 60 * 1000 // 2 years
    );
  }

  /**
   * Environment variables loading logic and validation
   */
  private loadEnv(): void {
    if (!process?.env) {
      throw new ServerError(ServerResponse.NO_ENV);
    }

    this._type = this.getEnvVar("ENV", "string", "prod");

    const envTypes = [...Object.values(EnvType)];
    if (!envTypes.includes(this._type)) {
      throw new ServerError(
        TemplateUtils.text(ServerResponse.INVALID_ENV_TYPE, {
          types: envTypes.join(", "),
          type: this._type,
        })
      );
    }

    switch (this._type) {
      case EnvType.PROD:
        this.logger.info("Running in production environment", {
          prefix: ENV_PREFIX,
        });
        break;
      case EnvType.DEV:
        this.logger.info("Running in development environment", {
          prefix: ENV_PREFIX,
        });
        break;
    }

    this.loadDB();

    this.LOG_LEVEL = this.getEnvVar("LOG_LEVEL", "string", "info");

    this.loadRedis();

    this.API_DOMAIN = this.getEnvVar("API_DOMAIN", "string", "localhost");
    this.CORS_ORIGINS = this.getEnvVar("CORS_ORIGINS", "string", "*").split(
      ","
    );
    this.SOCKET_IO_ADMIN_UI_ENABLE = this.getEnvVar(
      "SOCKET_IO_ADMIN_UI_ENABLE",
      "boolean",
      false
    );
    this.SOCKET_IO_ADMIN_UI_USERNAME = this.getEnvVar(
      "SOCKET_IO_ADMIN_UI_USERNAME",
      "string",
      "admin"
    );
    this.SOCKET_IO_ADMIN_UI_PASSWORD = this.getEnvVar(
      "SOCKET_IO_ADMIN_UI_PASSWORD",
      "string",
      "admin"
    );
  }

  private loadRedis() {
    this.REDIS_USERNAME = this.getEnvVar("REDIS_USERNAME", "string", "", true);
    this.REDIS_PASSWORD = this.getEnvVar("REDIS_PASSWORD", "string", "", true);
    this.REDIS_HOST = this.getEnvVar("REDIS_HOST", "string", "localhost");
    this.REDIS_PORT = this.getEnvVar("REDIS_PORT", "number", 6379);
    this.REDIS_DB_NUMBER = this.getEnvVar("REDIS_DB_NUMBER", "number", 0);
  }

  private loadDB() {
    const prod = this._type === "prod";

    this.DB_TYPE = this.getEnvVar("DB_TYPE", "string", "pg");
    this.DB_NAME = this.getEnvVar(
      "DB_NAME",
      "string",
      prod ? undefined : "openQuester"
    );
    this.DB_USER = this.getEnvVar(
      "DB_USER",
      "string",
      prod ? undefined : "root"
    );
    this.DB_PASS = this.getEnvVar("DB_PASS", "string");
    this.DB_HOST = this.getEnvVar(
      "DB_HOST",
      "string",
      prod ? undefined : "127.0.0.1"
    );
    this.DB_PORT = this.getEnvVar("DB_PORT", "number", 5432);
    this.DB_LOGGER = this.getEnvVar("DB_LOGGER", ["boolean", "string"], false);
  }

  private _checkType(
    value: unknown,
    type: EnvVar | EnvVar[]
  ): { success: boolean; resolvedType: EnvVar } {
    let success = false;
    let resolvedType: EnvVar = "string";

    if (ValueUtils.isArray(type)) {
      type.forEach((t) => {
        if (ValueUtils.checkPrimitiveType(value, t)) {
          success = true;
          resolvedType = t;
        }
      });
    } else {
      if (ValueUtils.checkPrimitiveType(value, type)) {
        success = true;
        resolvedType = type;
      }
    }

    return { success, resolvedType };
  }
}
