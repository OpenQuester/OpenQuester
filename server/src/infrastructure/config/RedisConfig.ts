import Redis from "ioredis";

import { ServerResponse } from "domain/enums/ServerResponse";
import { ServerError } from "domain/errors/ServerError";
import { Environment } from "infrastructure/config/Environment";
import { type ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

const REDIS_PREFIX = LogPrefix.REDIS;

export class RedisConfig {
  private static _client: Redis;
  private static _subClient: Redis;
  private static _env: Environment;
  private static _logger: ILogger;

  public static setLogger(logger: ILogger) {
    this._logger = logger;
  }

  public static getClient(): Redis {
    if (!this._client) {
      this._client = new Redis(this._getRedisLink(), {
        maxRetriesPerRequest: 10,
      });
    }
    return this._client;
  }

  public static getSubClient() {
    if (!this._subClient) {
      this._subClient = this._client.duplicate();
    }
    return this._subClient;
  }

  public static async initConfig() {
    await this._client.config("SET", "notify-keyspace-events", "Ex");
  }

  public static async waitForConnection(): Promise<void> {
    const client = this.getClient();

    if (client.status === "ready") {
      this._logger?.info("Redis client is ready", { prefix: REDIS_PREFIX });
      return;
    }

    return new Promise((resolve, reject) => {
      if (client.status === "connecting") {
        this._logger?.info("Redis client is connecting...", {
          prefix: REDIS_PREFIX,
        });
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new ServerError(ServerResponse.REDIS_CONNECTION_TIMEOUT));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeout);
        client.off("ready", readyHandler);
        client.off("error", errorHandler);
      };

      const readyHandler = () => {
        cleanup();
        this._logger?.info("Redis client is ready", { prefix: REDIS_PREFIX });
        resolve();
      };

      const errorHandler = (error: Error) => {
        cleanup();
        this._logger?.error(`Redis client error: ${error}`, {
          prefix: REDIS_PREFIX,
        });
        reject(error);
      };

      client.on("ready", readyHandler);
      client.on("error", errorHandler);
    });
  }

  public static async disconnect() {
    if (this._client && this._client.status === "ready") {
      this._client.disconnect(false);
    }

    try {
      await this._client.ping();
    } catch {
      this._logger?.warn("Redis connection closed", { prefix: REDIS_PREFIX });
    }

    if (this._subClient && this._subClient.status === "ready") {
      this._subClient.disconnect(false);
    }

    try {
      await this._subClient.ping();
    } catch {
      this._logger?.warn("Redis Sub Client connection closed", {
        prefix: REDIS_PREFIX,
      });
    }
  }

  private static _getRedisLink(): string {
    if (!this._env) {
      this._env = Environment?.getInstance(this._logger);
    }
    const username = this._env.REDIS_USERNAME || "";
    const password = this._env.REDIS_PASSWORD || "";
    const host = this._env.REDIS_HOST || "localhost";
    const port = this._env.REDIS_PORT || "6379";
    const dbNumber = this._env.REDIS_DB_NUMBER || "0";

    const auth = this._buildAuthString(username, password);

    // redis[s]://[[username][:password]@][host][:port][/db-number]
    return `redis://${auth}${host}:${port}/${dbNumber}`;
  }

  private static _buildAuthString(username: string, password: string): string {
    if (username && password) {
      return `${username}:${password}@`;
    } else if (username) {
      return `${username}@`;
    }
    return "";
  }
}
