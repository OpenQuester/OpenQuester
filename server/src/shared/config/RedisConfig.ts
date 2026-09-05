import Redis from "ioredis";

import { ServerResponse } from "domain/enums/ServerResponse";
import { ServerError } from "domain/errors/ServerError";
import { EnvType, Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
const REDIS_PREFIX = LogPrefix.REDIS;
const REDIS_CONNECTION_TIMEOUT_MS = 2000;
const REDIS_DISCONNECT_TIMEOUT_MS = 500;

interface PendingRedisCommand {
  promise?: Promise<unknown>;
}

interface RedisCommandQueueItem {
  command?: PendingRedisCommand;
}

interface RedisCommandQueue {
  length: number;
  peekAt(index: number): RedisCommandQueueItem | undefined;
}

interface RedisClientWithCommandQueue {
  commandQueue?: RedisCommandQueue;
}

export interface RedisDisconnectOptions {
  strict?: boolean;
}

type RedisPubSubMethodName = "subscribe" | "psubscribe" | "unsubscribe" | "punsubscribe";
type RedisPubSubMethod = (...args: unknown[]) => Promise<unknown>;
type RedisClientWithPubSubMethods = Redis & Record<RedisPubSubMethodName, RedisPubSubMethod>;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class RedisConfig {
  private static _client: Redis;
  private static _subClient: Redis;
  private static _env: Environment;
  private static _logger: ILogger;
  private static _closingClients = new WeakSet<Redis>();
  private static _observedPubSubClients = new WeakSet<Redis>();
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

  public static async disconnect(options: RedisDisconnectOptions = {}): Promise<void> {
    // Close duplicates first so no pub/sub callbacks race against root client shutdown.
    const clients = Array.from(this._clients).reverse();

    if (!options.strict) {
      for (const client of clients) {
        await this.disconnectClient(client, "Redis connection", false);
      }

      this._resetClients();
      return;
    }

    const failures: Error[] = [];

    try {
      const results = await Promise.allSettled(
        clients.map((client, index) =>
          this.disconnectClient(client, `Redis connection ${index + 1}/${clients.length}`, true)
        )
      );
      for (const result of results) {
        if (result.status === "rejected") {
          failures.push(toError(result.reason));
        }
      }
    } finally {
      this._resetClients();
    }

    if (options.strict && failures.length > 0) {
      throw new AggregateError(
        failures,
        `Redis disconnect failed: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  private static async disconnectClient(
    client: Redis | undefined,
    errorMessage: string,
    strict: boolean
  ): Promise<void> {
    if (!client || client.status === "end") {
      return;
    }

    const failures: Error[] = [];
    this._closingClients.add(client);

    try {
      await this._waitForPendingCommands(client, strict);
    } catch (error) {
      if (!strict) {
        this._warnDisconnectFailure(errorMessage, error);
        return;
      }
      failures.push(toError(error));
    }

    const waitForClose = this._waitForClientClose(client, strict);
    const closeOutcome = waitForClose.then(
      () => undefined,
      (error: unknown) => toError(error)
    );
    let expectedDisconnectError = false;

    try {
      if (client.status === "ready") {
        if (strict) {
          await Promise.race([client.quit(), waitForClose]);
        } else {
          await client.quit();
        }
      } else {
        client.disconnect(false);
      }
      await waitForClose;
    } catch (error) {
      expectedDisconnectError = this._isExpectedDisconnectError(error);
      if (!strict) {
        if (!expectedDisconnectError) {
          this._warnDisconnectFailure(errorMessage, error);
        }
        return;
      }

      if (!expectedDisconnectError) {
        failures.push(toError(error));
      }

      try {
        client.disconnect(false);
      } catch (disconnectError) {
        if (!this._isExpectedDisconnectError(disconnectError)) {
          failures.push(toError(disconnectError));
        }
      }
    }

    const closeError = await closeOutcome;
    if (
      closeError &&
      closeError !== failures[failures.length - 1] &&
      !expectedDisconnectError &&
      !this._isExpectedDisconnectError(closeError)
    ) {
      failures.push(closeError);
    }

    if (strict && failures.length > 0) {
      throw new AggregateError(
        failures,
        `${errorMessage} failed to close: ${failures.map((failure) => failure.message).join("; ")}`
      );
    }
  }

  private static async _waitForPendingCommands(client: Redis, strict = false): Promise<void> {
    const pendingCommands = this._getPendingCommandPromises(client, strict);
    if (pendingCommands.length === 0) {
      return;
    }

    let timeout: NodeJS.Timeout | undefined;
    const deadline = new Promise<undefined>((resolve, reject) => {
      timeout = setTimeout(() => {
        if (strict) {
          reject(
            new Error(
              `Timed out after ${REDIS_DISCONNECT_TIMEOUT_MS}ms waiting for ` +
                `${pendingCommands.length} pending Redis command(s) during disconnect`
            )
          );
        } else {
          resolve(undefined);
        }
      }, REDIS_DISCONNECT_TIMEOUT_MS);
    });
    let results: PromiseSettledResult<unknown>[] | undefined;

    try {
      results = await Promise.race([Promise.allSettled(pendingCommands), deadline]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    if (!results) {
      return;
    }

    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason)
      .filter((error) => !this._isExpectedDisconnectError(error))
      .map((error) => (error instanceof Error ? error : new Error(String(error))));

    if (strict && failures.length > 0) {
      throw new AggregateError(failures, "Redis pending commands failed during disconnect");
    }

    for (const error of failures) {
      this._logger?.warn("Redis pending command failed during disconnect", {
        prefix: REDIS_PREFIX,
        error: error.message
      });
    }
  }

  private static _getPendingCommandPromises(client: Redis, strict = false): Promise<unknown>[] {
    const queue = (client as unknown as RedisClientWithCommandQueue).commandQueue;
    if (!queue) {
      return [];
    }

    const promises: Promise<unknown>[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const promise = queue.peekAt(index)?.command?.promise;
      if (promise) {
        promises.push(
          strict
            ? promise
            : promise.catch((error: unknown) => {
                if (!this._isExpectedDisconnectError(error)) {
                  this._logger?.warn("Redis pending command failed during disconnect", {
                    prefix: REDIS_PREFIX,
                    error: error instanceof Error ? error.message : String(error)
                  });
                }
              })
        );
      }
    }

    return promises;
  }

  private static async _waitForClientClose(client: Redis, strict = false): Promise<void> {
    if (client.status === "end") {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        client.off("end", onClose);
        client.off("close", onClose);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      const onClose = (): void => finish();
      const timeout = setTimeout(() => {
        finish(
          strict
            ? new Error(
                `Timed out after ${REDIS_DISCONNECT_TIMEOUT_MS}ms waiting for Redis client close`
              )
            : undefined
        );
      }, REDIS_DISCONNECT_TIMEOUT_MS);

      client.once("end", onClose);
      client.once("close", onClose);
    });
  }

  private static _resetClients(): void {
    this._client = undefined as unknown as Redis;
    this._subClient = undefined as unknown as Redis;
    this._clients.clear();
  }

  private static _warnDisconnectFailure(errorMessage: string, error: unknown): void {
    this._logger?.warn(`${errorMessage} closed`, {
      prefix: REDIS_PREFIX,
      error: error instanceof Error ? error.message : String(error)
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
    this._observePubSubCommandRejections(client, clientName);

    const duplicate = client.duplicate.bind(client);
    client.duplicate = ((...args: Parameters<Redis["duplicate"]>) => {
      const duplicatedClient = duplicate(...args);
      this._registerClient(duplicatedClient, `${clientName} duplicate`);
      return duplicatedClient;
    }) as Redis["duplicate"];
  }

  private static _observePubSubCommandRejections(client: Redis, clientName: string): void {
    if (this._observedPubSubClients.has(client)) {
      return;
    }

    this._observedPubSubClients.add(client);
    const redisClient = client as unknown as RedisClientWithPubSubMethods;
    const methods: RedisPubSubMethodName[] = [
      "subscribe",
      "psubscribe",
      "unsubscribe",
      "punsubscribe"
    ];

    for (const method of methods) {
      const original = redisClient[method].bind(client);
      redisClient[method] = ((...args: unknown[]): Promise<unknown> => {
        const result = original(...args);
        void result.catch((error: unknown) => {
          if (this._isExpectedDisconnectError(error)) {
            return;
          }

          this._logger?.warn(`${clientName} ${method} command failed`, {
            prefix: REDIS_PREFIX,
            error: error instanceof Error ? error.message : String(error)
          });
        });

        return result;
      }) as RedisClientWithPubSubMethods[typeof method];
    }
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
