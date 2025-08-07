import { DataSource, DataSourceOptions } from "typeorm";

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

export function setTestEnvDefaults() {
  process.env.ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.DB_TYPE = "pg";
  process.env.DB_NAME = "test_db";
  process.env.DB_USER = "postgres";
  // process.env.DB_PASS = "postgres";
  process.env.DB_PASS = "Asdf1234!";
  process.env.DB_HOST = "localhost";
  process.env.DB_PORT = "5432";
  process.env.DB_LOGGER = "false";
  process.env.SESSION_SECRET = "test_secret";
  process.env.API_DOMAIN = "localhost";
  process.env.SESSION_MAX_AGE = "3600000";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.REDIS_DB_NUMBER = "0";
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
