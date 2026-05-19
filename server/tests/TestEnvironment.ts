import { Client } from "pg";
import { DataSource } from "typeorm";

import { RedisConfig } from "shared/config/RedisConfig";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { RedisTestUtils } from "tests/utils/RedisTestUtils";
import { createTestAppDataSource } from "tests/utils/utils";
import { getTestDbName } from "tests/utils/TestTimeouts";

type ClosableLogger = ILogger & {
  close?: () => Promise<void>;
};

export class TestEnvironment {
  private testDataSource!: DataSource;

  constructor(private readonly logger: ILogger) {
    //
  }

  public async setup(): Promise<void> {
    this.testDataSource = createTestAppDataSource();
    await this.createTestDatabase();
    await this.testDataSource.initialize();
    await this.testDataSource.runMigrations();

    // Init Redis configuration
    RedisConfig.getClient(); // Get client to initialize it
    await RedisConfig.initConfig();
    await RedisConfig.waitForConnection();
    await this.clearRedis();
  }

  public async teardown(): Promise<void> {
    this.logger.info("Tearing down test environment...", {
      prefix: LogPrefix.TEST
    });
    if (this.testDataSource?.isInitialized) {
      await this.testDataSource.destroy();
    }
    await this.dropTestDatabase();

    const closableLogger = this.logger as ClosableLogger;
    await closableLogger.close?.();
  }

  public getDatabase() {
    return this.testDataSource;
  }

  /**
   * Clear all Redis keys with robust cleanup logic
   * Should be called in beforeEach to ensure clean state
   */
  public async clearRedis(): Promise<void> {
    await RedisTestUtils.clearAllKeys();
  }

  private async createTestDatabase(): Promise<void> {
    const dbName = process.env.DB_NAME || getTestDbName();
    const client = this._getPGClient();
    await client.connect();
    await this._forceDropTestDatabase(client, dbName);
    await client.query(`CREATE DATABASE ${this._escapeIdentifier(dbName)};`);
    await client.end();
  }

  private async dropTestDatabase(): Promise<void> {
    const dbName = process.env.DB_NAME || getTestDbName();
    const client = this._getPGClient();
    await client.connect();
    await this._forceDropTestDatabase(client, dbName);
    await client.end();
  }

  private async _forceDropTestDatabase(client: Client, dbName: string): Promise<void> {
    await client.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid();
      `,
      [dbName]
    );

    await client.query(`DROP DATABASE IF EXISTS ${this._escapeIdentifier(dbName)};`);
  }

  private _getPGClient() {
    return new Client({
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASS || "postgres",
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: "postgres"
    });
  }

  private _escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
