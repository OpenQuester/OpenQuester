import { Client } from "pg";
import { DataSource, DataSourceOptions } from "typeorm";

export interface Fixture {
  entity: any;
  data: any[];
}

export class TestEnvironment {
  private testDataSource!: DataSource;

  constructor(private readonly dataSource: DataSource) {
    //
  }

  public async setup(): Promise<void> {
    await this.createTestDatabase();
    const options: DataSourceOptions = {
      ...this.dataSource.options,
      database: "test_db" as any,
    };

    this.testDataSource = new DataSource(options);
    await this.testDataSource.initialize();
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
