import Redis from "ioredis";

import { ServerResponse } from "domain/enums/ServerResponse";
import { ServerError } from "domain/errors/ServerError";
import { EnvType, Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
const REDIS_PREFIX = LogPrefix.REDIS;
const REDIS_CONNECTION_TIMEOUT_MS = 2000;
const REDIS_DISCONNECT_TIMEOUT_MS = 500;

export class RedisConfig {
  private static _client: Redis;
  private static _subClient: Redis;
  private static _env: Environment;
  private static _logger: ILogger;
  private static _closingClients = new WeakSet<Redis>();
  private static _clients = new Set<Redis>();

  public static setLogger(logger: ILogger): void {
    this._logger = logger;
  }

  public static getClient(): Redis {
    if (this._client && !this._isClientUsable(this._client)) {
      this._logger?.warn("Replacing inactive Redis client", { prefix: REDIS_PREFIX });
      this._client = undefined as unknown as Redis;
    }

    if (!this._client) {
      this._client = new Redis(this._getRedisLink(), {
        connectTimeout: this._getConnectionTimeoutMs(),
        maxRetriesPerRequest: 10,
        enableAutoPipelining: !this._isTestEnv()
      });
      this._registerClient(this._client, "Redis client");
    }
    return this._client;
  }

  public static getSubClient(): Redis {
    if (this._subClient && !this._isClientUsable(this._subClient)) {
      this._logger?.warn("Replacing inactive Redis sub client", { prefix: REDIS_PREFIX });
      this._subClient = undefined as unknown as Redis;
    }

    if (!this._subClient) {
      this._subClient = this.getClient().duplicate();
      this._registerClient(this._subClient, "Redis sub client");
    }
    return this._subClient;
  }

  public static async initConfig(): Promise<void> {
    const client = this.getClient();

    if (client.status !== "ready") {
      await this.waitForConnection();
    }

    await client.config("SET", "notify-keyspace-events", "Ex");
  }

  public static async waitForConnection(): Promise<void> {
    const client = this.getClient();

    if (client.status === "ready") {
      this._logger?.info("Redis client is ready", { prefix: REDIS_PREFIX });
      return;
    }

    return new Promise((resolve, reject) => {
      if (client.status === "connecting") {
        this._logger?.info("Redis client is connecting...", { prefix: REDIS_PREFIX });
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(new ServerError(ServerResponse.REDIS_CONNECTION_TIMEOUT));
      }, REDIS_CONNECTION_TIMEOUT_MS);

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
        this._logger?.error(`Redis client error: ${error}`, { prefix: REDIS_PREFIX });
        reject(error);
      };

      client.on("ready", readyHandler);
      client.on("error", errorHandler);
    });
  }

  public static async disconnect(): Promise<void> {
    // Close duplicates first so no pub/sub callbacks race against root client shutdown.
    const clients = Array.from(this._clients).reverse();
    for (const client of clients) {
      await this.disconnectClient(client, "Redis connection");
    }

    this._client = undefined as unknown as Redis;
    this._subClient = undefined as unknown as Redis;
    this._clients.clear();
  }

  private static async disconnectClient(
    client: Redis | undefined,
    errorMessage: string
  ): Promise<void> {
    if (!client || client.status === "end") {
      return;
    }

    try {
      this._closingClients.add(client);
      const waitForClose = this._waitForClientClose(client);

      if (client.status === "ready") {
        await client.quit();
        await waitForClose;
        return;
      }

      client.disconnect(false);
      await waitForClose;
    } catch (error) {
      if (this._isExpectedDisconnectError(error)) {
        return;
      }

      this._logger?.warn(`${errorMessage} closed`, {
        prefix: REDIS_PREFIX,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private static async _waitForClientClose(client: Redis): Promise<void> {
    if (client.status === "end") {
      return;
    }

    await new Promise<void>((resolve) => {
      const cleanup = (): void => {
        clearTimeout(timeout);
        client.off("end", cleanup);
        client.off("close", cleanup);
        resolve();
      };
      const timeout = setTimeout(cleanup, REDIS_DISCONNECT_TIMEOUT_MS);

      client.once("end", cleanup);
      client.once("close", cleanup);
    });
  }

  private static _getConnectionTimeoutMs(): number {
    if (this._isTestEnv()) {
      return REDIS_CONNECTION_TIMEOUT_MS;
    }

    return 30000;
  }

  private static _isClientUsable(client: Redis): boolean {
    return (
      client.status === "ready" ||
      client.status === "connecting" ||
      client.status === "reconnecting"
    );
  }

  private static _attachErrorHandler(client: Redis, clientName: string): void {
    client.on("error", (error: Error) => {
      if (this._closingClients.has(client) || this._isExpectedDisconnectError(error)) {
        return;
      }

      this._logger?.warn(`${clientName} error: ${error.message}`, {
        prefix: REDIS_PREFIX
      });
    });
  }

  private static _registerClient(client: Redis, clientName: string): void {
    if (this._clients.has(client)) {
      return;
    }

    this._clients.add(client);
    this._attachErrorHandler(client, clientName);

    const duplicate = client.duplicate.bind(client);
    client.duplicate = ((...args: Parameters<Redis["duplicate"]>) => {
      const duplicatedClient = duplicate(...args);
      this._registerClient(duplicatedClient, `${clientName} duplicate`);
      return duplicatedClient;
    }) as Redis["duplicate"];
  }

  private static _isExpectedDisconnectError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("Connection is closed");
  }

  private static _isTestEnv(): boolean {
    return this._env?.ENV === EnvType.TEST || process.env.ENV === "test";
  }

  private static _getRedisLink(): string {
    if (!this._env && this._logger) {
      this._env = Environment.getInstance(this._logger);
    }

    const env = this._env;

    const username = env?.REDIS_USERNAME || process.env.REDIS_USERNAME || "";
    const password = env?.REDIS_PASSWORD || process.env.REDIS_PASSWORD || "";
    const host = String(env?.REDIS_HOST || process.env.REDIS_HOST || "localhost");
    const port = String(env?.REDIS_PORT || process.env.REDIS_PORT || "6379");
    const dbNumber = String(env?.REDIS_DB_NUMBER || process.env.REDIS_DB_NUMBER || "0");
    const auth = this._buildAuthString(username, password);

    return `redis://${auth}${host}:${port}/${dbNumber}`;
  }

  private static _buildAuthString(username: string, password: string): string {
    if (username && password) {
      return `${username}:${password}@`;
    }
    if (username) {
      return `${username}@`;
    }
    return "";
  }
}
