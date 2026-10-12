import { DataSource, DataSourceOptions } from "typeorm";
import {
  getTestApiPort,
  getTestDbName,
  getTestRedisDb,
  TEST_TIMEOUTS
} from "tests/utils/TestTimeouts";

// Models
import { File } from "infrastructure/database/models/File";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageAnswerFile } from "infrastructure/database/models/package/PackageAnswerFile";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { PackageQuestionChoiceAnswer } from "infrastructure/database/models/package/PackageQuestionChoiceAnswer";
import { PackageQuestionFile } from "infrastructure/database/models/package/PackageQuestionFile";
import { PackageRound } from "infrastructure/database/models/package/PackageRound";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { PackageTheme } from "infrastructure/database/models/package/PackageTheme";
import { Permission } from "infrastructure/database/models/Permission";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { User } from "infrastructure/database/models/User";

interface TestEnvDefaultsOptions {
  apiPort?: number;
  startupRecoveryEnabled?: boolean;
}

interface TestRedisSettings {
  readonly host: string;
  readonly port: string;
  readonly username: string;
  readonly password: string;
  readonly dbNumber: string;
}

export interface TestPostgresSettings {
  readonly host: string;
  readonly port: string;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

/**
 * Resolves the only PostgreSQL settings destructive E2E setup may use.
 * Ordinary DB_* values may belong to a developer runtime and are ignored.
 */
export function resolveTestPostgresSettings(
  env: NodeJS.ProcessEnv = process.env
): TestPostgresSettings {
  return {
    host: env.TEST_DB_HOST ?? "127.0.0.1",
    port: env.TEST_DB_PORT ?? "5432",
    user: env.TEST_DB_USER ?? "postgres",
    password: env.TEST_DB_PASS ?? "postgres",
    database: getTestDbName()
  };
}

/**
 * Resolves the only Redis settings test setup is allowed to use.
 *
 * Test cleanup deletes all keys in its selected Redis database, so ordinary
 * runtime REDIS_* values and a developer .env must never influence this
 * target. CI/local callers can opt in through the TEST_REDIS_* variables.
 */
export function resolveTestRedisSettings(env: NodeJS.ProcessEnv = process.env): TestRedisSettings {
  return {
    host: env.TEST_REDIS_HOST ?? "127.0.0.1",
    port: env.TEST_REDIS_PORT ?? "6380",
    username: env.TEST_REDIS_USERNAME ?? "",
    password: env.TEST_REDIS_PASSWORD ?? "",
    dbNumber: env.TEST_REDIS_DB_NUMBER ?? String(getTestRedisDb())
  };
}

export function setTestEnvDefaults(options: TestEnvDefaultsOptions = {}) {
  const postgresSettings = resolveTestPostgresSettings();

  process.env.ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.API_PORT = String(options.apiPort ?? getTestApiPort());
  process.env.DB_TYPE = "pg";
  process.env.DB_NAME = postgresSettings.database;
  process.env.DB_USER = postgresSettings.user;
  process.env.DB_PASS = postgresSettings.password;
  process.env.DB_HOST = postgresSettings.host;
  process.env.DB_PORT = postgresSettings.port;
  process.env.DB_LOGGER = "false";
  process.env.SESSION_SECRET = "test_secret";
  process.env.API_DOMAIN = "localhost";
  process.env.SESSION_MAX_AGE = "3600000";
  const redisSettings = resolveTestRedisSettings();
  process.env.REDIS_USERNAME = redisSettings.username || (redisSettings.password ? "default" : "");
  process.env.REDIS_PASSWORD = redisSettings.password;
  process.env.REDIS_HOST = redisSettings.host;
  process.env.REDIS_PORT = redisSettings.port;
  process.env.REDIS_DB_NUMBER = redisSettings.dbNumber;
  process.env.CORS_ORIGINS = "localhost";
  process.env.SOCKET_IO_CORS_ORIGINS = "localhost";
  process.env.LOG_LEVEL = "trace";
  // Dummy S3, we don't check S3 in tests, used just to avoid errors
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_URL_PREFIX = "http://bucket.localhost:9000";
  process.env.S3_USE_SUB_DOMAIN_BUCKET_FORMAT = "false";
  process.env.S3_USE_SSL = "false";
  process.env.S3_BUCKET = "test-bucket";
  process.env.S3_ACCESS_KEY = "test-access-key";
  process.env.S3_SECRET_KEY = "test-secret-key";
  process.env.S3_REGION = "eu-west";
  // Disable InfluxDB metrics in tests — no InfluxDB instance available
  process.env.INFLUX_URL = "";
  process.env.STARTUP_RECOVERY_ENABLED = String(options.startupRecoveryEnabled ?? false);
}

export function createTestAppDataSource() {
  setTestEnvDefaults();
  const options: DataSourceOptions = {
    type: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [
      User,
      File,
      Permission,
      Package,
      FileUsage,
      PackageAnswerFile,
      PackageQuestion,
      PackageQuestionFile,
      PackageRound,
      PackageTag,
      PackageTheme,
      PackageQuestionChoiceAnswer,
      GameStatistics,
      PlayerGameStats
    ],
    migrations: [],
    synchronize: true,
    logging: false,
    extra: {
      connectionTimeoutMillis: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
      query_timeout: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS,
      statement_timeout: TEST_TIMEOUTS.POSTGRES_LIFECYCLE_TIMEOUT_MS
    }
  };
  return new DataSource(options);
}
