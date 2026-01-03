import { DataSource, EntityTarget, ObjectLiteral, Repository } from "typeorm";

import { ServerResponse } from "domain/enums/ServerResponse";
import { ServerError } from "domain/errors/ServerError";
import { type ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

const DB_PREFIX = LogPrefix.DB;

/**
 * Handles Database initialization and management
 */
export class Database {
  private static _instanceMap: Map<DataSource, Database> = new Map();
  private _connected: boolean = false;
  private _repositories: Map<EntityTarget<any>, Repository<any>> = new Map();

  private constructor(
    private readonly _dataSource: DataSource,
    private readonly _logger: ILogger
  ) {
    if (!this._dataSource) {
      throw new ServerError(ServerResponse.INVALID_DATA_SOURCE);
    }
    if (!this._dataSource.isInitialized) {
      void this._dataSource.initialize();
    }
  }

  /**
   * Get or create instance from specified data source
   */
  public static getInstance(dataSource: DataSource, logger: ILogger): Database {
    const db = Database._instanceMap.get(dataSource);

    if (!db) {
      const freshDatabase = new Database(dataSource, logger);
      Database._instanceMap.set(dataSource, freshDatabase);
      return freshDatabase;
    }

    return db;
  }

  /**
   * Build connection to the database
   */
  public async build() {
    this._logger.info("Connecting to DB...", { prefix: DB_PREFIX });

    try {
      // Force only one DataSource init at the time, so only one migrations runner will be executed
      if (!this._dataSource.isInitialized) {
        await this.waitForInitialization();
      }
      this._connected = true;
      this._logger.info("Connection to DB established", { prefix: DB_PREFIX });
    } catch (err: unknown) {
      let message = "unknown error";
      if (err instanceof Error) {
        message = err.message;
      }
      throw new ServerError(`${ServerResponse.DB_NOT_CONNECTED} -> ${message}`);
    }
  }

  public async waitForInitialization() {
    if (this._dataSource.isInitialized) {
      return true;
    }

    return new Promise<void>((resolve) => {
      // Initialization timeout
      const timeout = setTimeout(() => {
        if (!this._dataSource.isInitialized) {
          throw new ServerError(ServerResponse.NOT_INITIALIZED);
        }
      }, 30000);

      const interval = setInterval(() => {
        if (this._dataSource.isInitialized) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Get TypeORM repository for the given entity.
   * Caches the repository to avoid multiple creations.
   */
  public getRepository<T extends ObjectLiteral>(
    target: EntityTarget<T>
  ): Repository<T> {
    if (!this._connected) {
      throw new ServerError(ServerResponse.DB_NOT_CONNECTED);
    }

    let repository = this._repositories.get(target) as Repository<T>;

    if (!repository) {
      repository = this._dataSource.getRepository(target);
      this._repositories.set(target, repository);
    }

    return repository;
  }

  public get dataSource(): DataSource {
    if (!this._connected) {
      throw new ServerError(ServerResponse.DB_NOT_CONNECTED);
    }
    return this._dataSource;
  }

  public connect(): void {
    this._connected = true;
  }

  public async disconnect(): Promise<void> {
    if (this._dataSource.isInitialized) {
      await this._dataSource.destroy();
    }
    Database._instanceMap.delete(this._dataSource);
    this._connected = false;
    this._logger.warn("Database connection closed", { prefix: DB_PREFIX });
  }

  public get connected(): boolean {
    return this._connected;
  }
}
