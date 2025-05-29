import { Client } from "pg";
import { DataSource } from "typeorm";
import { createTestAppDataSource } from "./TestUtils";

export interface Fixture {
  entity: any;
  data: any[];
}

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
  }

  public async teardown(): Promise<void> {
    if (this.testDataSource) {
      await this.testDataSource.destroy();
    }
    await this.dropTestDatabase();
  }

  async reset(fixtures: Fixture[]): Promise<void> {
    for (const fixture of fixtures) {
      const repo = this.testDataSource.getRepository(fixture.entity);
      await repo.delete({});
      await repo.save(fixture.data);
    }
  }

  public getDatabase() {
    return this.testDataSource;
  }

  private async createTestDatabase(): Promise<void> {
    const client = new Client({
      user: "postgres",
      password: "postgres",
      host: "127.0.0.1",
      port: 5432,
    });
    await client.connect();
    await client.query("DROP DATABASE IF EXISTS test_db;");
    await client.query("CREATE DATABASE test_db;");
    await client.end();
  }

  private async dropTestDatabase(): Promise<void> {
    const client = new Client({
      user: "postgres",
      password: "postgres",
      host: "127.0.0.1",
      port: 5432,
    });
    await client.connect();
    await client.query("DROP DATABASE IF EXISTS test_db;");
    await client.end();
  }
}
