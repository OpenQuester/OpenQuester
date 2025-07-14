import { Client } from "pg";
import { DataSource } from "typeorm";

import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Logger } from "infrastructure/utils/Logger";
import { createTestAppDataSource } from "tests/utils/utils";

export class TestEnvironment {
  private testDataSource!: DataSource;

  constructor() {
    //
  }

  public async setup(): Promise<void> {
    await this.createTestDatabase();
    this.testDataSource = createTestAppDataSource();
    await this.testDataSource.initialize();
    await this.testDataSource.runMigrations();

    // Init Redis configuration
    RedisConfig.getClient(); // Get client to initialize it
    await RedisConfig.initConfig();
    await RedisConfig.waitForConnection();
  }

  public async teardown(): Promise<void> {
    Logger.info("Tearing down test environment...");
    if (this.testDataSource) {
      await this.testDataSource.destroy();
    }
    await this.dropTestDatabase();
  }

  public getDatabase() {
    return this.testDataSource;
  }

  private async createTestDatabase(): Promise<void> {
    const client = this._getPGClient();
    await client.connect();
    await client.query("DROP DATABASE IF EXISTS test_db;");
    await client.query("CREATE DATABASE test_db;");
    await client.end();
  }

  private async dropTestDatabase(): Promise<void> {
    const client = this._getPGClient();
    await client.connect();
    await client.query("DROP DATABASE IF EXISTS test_db;");
    await client.end();
  }

  private _getPGClient() {
    const client = new Client({
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASS || "postgres",
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
    });

    return client;
  }
}
