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
import { User } from "infrastructure/database/models/User";

// Migrations imports
import { UpdateUserModelFields_0_1_11_1723107959823 as updateUserModelFields } from "infrastructure/database/migrations/0.1.11_UpdateUserModelFields";
import { CreateUserAndFileTables_0_1_1_1722683756069 as createUserAndFileTables } from "infrastructure/database/migrations/0.1.1_CreateUserAndFileTables";
import { UpdateUserRequiredFields_0_1_21_1723204474011 as updateUserRequiredFields } from "infrastructure/database/migrations/0.1.21_UpdateUserRequiredFields";
import { CreatePermissionTable_0_1_2_1723128633623 as createPermissionTable } from "infrastructure/database/migrations/0.1.2_CreatePermissionTable";
import { AddOrderColumn_1745439282807 as AddOrderColumn } from "infrastructure/database/migrations/0.11.4_AddOrderColumn";
import { AddTypeToPackageRound_1747924851733 as AddTypeToPackageRound } from "infrastructure/database/migrations/0.14.2_AddTypeToPackageRound";
import { WriteMoreInfoToDB_0_2_9_1725692779638 as writeMoreToDB } from "infrastructure/database/migrations/0.2.9_WriteMoreInfoToDB";
import { ChangePermissionValidation_0_3_0_1729181792142 as changePermissionValidation } from "infrastructure/database/migrations/0.3.0_ChangePermissionValidation";
import { AddDeleteFilePermission_0_3_9_1730832569761 as addDeletePermission } from "infrastructure/database/migrations/0.3.9_AddDeleteFilePermission";
import { AddFileUsageTable_1731771003354 as addFileUsageTable } from "infrastructure/database/migrations/0.3.9_Part2AddFileUsageTable";
import { RenameAuthorAndAvatarId_1734207358779 as renameAuthorAndAvatarId } from "infrastructure/database/migrations/0.3.9_Part3RenameAuthorId";
import { UpdateUserAndFileAndAddDiscordId_0_8_2_1738571232826 as updateUserAndFileAndAddDiscordId } from "infrastructure/database/migrations/0.8.2_UpdateUserAndFileAndAddDiscordId";
import { ChangePackageModel_0_9_7_1739806266677 as changePackageModel } from "infrastructure/database/migrations/0.9.7_ChangePackageModel";
import { MakeAuthorNullable_1742725198044 as MakeAuthorNullable } from "infrastructure/database/migrations/0.9.7_Part2MakeAuthorNullable";
import { UpdatePackageTypesAndFields_1742727260372 as UpdatePackageTypesAndFields } from "infrastructure/database/migrations/0.9.7_Part3UpdatePackageTypesAndFields";
import { AddPackageLogoFileForeignKey_1743338225856 as AddPackageLogoFK } from "infrastructure/database/migrations/0.9.7_Part4AddPackageLogoFileFK";
import { AddTypeColumnForChoiceFile_1743660505666 as AddTypeColumnForChoiceFile } from "infrastructure/database/migrations/0.9.7_Part5AddTypeColumnForChoiceFile";

export function setTestEnvDefaults() {
  process.env.ENV = "test";
  process.env.NODE_ENV = "test";
  process.env.DB_TYPE = "pg";
  process.env.DB_NAME = "test_db";
  process.env.DB_USER = "postgres";
  process.env.DB_PASS = "postgres";
  process.env.DB_HOST = "localhost";
  process.env.DB_PORT = "5432";
  process.env.DB_LOGGER = "false";
  process.env.SESSION_SECRET = "test_secret";
  process.env.API_DOMAIN = "localhost";
  process.env.SESSION_MAX_AGE = "3600000";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.REDIS_DB_NUMBER = "12";
  process.env.CORS_ORIGINS = "localhost";
  process.env.SOCKET_IO_CORS_ORIGINS = "localhost";
  process.env.LOG_LEVEL = "info";
  // Dummy S3, we don't check S3 in tests, used just to avoid errors
  process.env.S3_HOST = "http://localhost:9000";
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
    ],
    migrations: [
      createUserAndFileTables,
      createPermissionTable,
      updateUserModelFields,
      updateUserRequiredFields,
      writeMoreToDB,
      changePermissionValidation,
      addDeletePermission,
      addFileUsageTable,
      renameAuthorAndAvatarId,
      updateUserAndFileAndAddDiscordId,
      changePackageModel,
      MakeAuthorNullable,
      UpdatePackageTypesAndFields,
      AddPackageLogoFK,
      AddTypeColumnForChoiceFile,
      AddOrderColumn,
      AddTypeToPackageRound,
    ],
    synchronize: false,
    logging: false,
  };
  return new DataSource(options);
}
