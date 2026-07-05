import dotenv, { type DotenvParseOutput } from "dotenv";
import path from "path";
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

const DEFAULT_TEST_REDIS_HOST = "localhost";
const DEFAULT_TEST_REDIS_PORT = "6379";

let cachedLocalEnvOverrides: DotenvParseOutput | undefined;

interface TestEnvDefaultsOptions {
  apiPort?: number;
  startupRecoveryEnabled?: boolean;
}

export function setTestEnvDefaults(options: TestEnvDefaultsOptions = {}) {
  process.env.ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.API_PORT = String(options.apiPort ?? getTestApiPort());
  process.env.DB_TYPE = "pg";
  if (!process.env.DB_NAME) {
    process.env.DB_NAME = getTestDbName();
  }
  process.env.DB_USER ||= "postgres";
  process.env.DB_PASS ||= "postgres";
  process.env.DB_HOST ||= "localhost";
  process.env.DB_PORT ||= "5432";
  process.env.DB_LOGGER = "false";
  process.env.SESSION_SECRET = "test_secret";
  process.env.API_DOMAIN = "localhost";
  process.env.SESSION_MAX_AGE = "3600000";
  process.env.REDIS_USERNAME = getRedisTestEnvValue("REDIS_USERNAME", "");
  process.env.REDIS_PASSWORD = getRedisTestEnvValue("REDIS_PASSWORD", "");
  process.env.REDIS_HOST = getRedisTestEnvValue("REDIS_HOST", DEFAULT_TEST_REDIS_HOST);
  process.env.REDIS_PORT = getRedisTestEnvValue("REDIS_PORT", DEFAULT_TEST_REDIS_PORT);
  if (!process.env.REDIS_DB_NUMBER) {
    process.env.REDIS_DB_NUMBER = String(getTestRedisDb());
  }
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
  process.env.TEST_DB_NAME_PREFIX = TEST_TIMEOUTS.TEST_DB_NAME_PREFIX;
  process.env.STARTUP_RECOVERY_ENABLED = String(options.startupRecoveryEnabled ?? false);
}

function getRedisTestEnvValue(key: string, defaultValue: string): string {
  return process.env[key] ?? getLocalEnvOverrides()[key] ?? defaultValue;
}

function getLocalEnvOverrides(): DotenvParseOutput {
  if (isCiEnv()) {
    return {};
  }

  if (!cachedLocalEnvOverrides) {
    const processEnv: DotenvParseOutput = {};
    const result = dotenv.config({
      path: path.resolve(process.cwd(), ".env"),
      processEnv,
      quiet: true
    });
    cachedLocalEnvOverrides = result.parsed ?? {};
  }

  return cachedLocalEnvOverrides;
}

function isCiEnv(): boolean {
  return process.env.CI === "true" || process.env.CI === "1";
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
      PlayerGameStats,
    ],
    migrations: [],
    synchronize: true,
    logging: false,
  };
  return new DataSource(options);
}
