import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { LogPrefix } from "shared/logging/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * Storage limits (docs/specs/storage-limits.md): file sizes, per-group
 * limits with a per-user quota override, last-seen time for guest cleanup,
 * and the manage_storage permission for every existing admin.
 */
export class AddStorageLimits_0_26_0_1792200000000 implements MigrationInterface {
  name = "AddStorageLimits_0_26_0_1792200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("file", [
      new TableColumn({ name: "size", type: "bigint", isNullable: true }),
      new TableColumn({
        name: "size_verified_at",
        type: "timestamp with time zone",
        isNullable: true
      })
    ]);
    await queryRunner.addColumns("user", [
      new TableColumn({ name: "storage_quota_bytes", type: "bigint", isNullable: true }),
      new TableColumn({
        name: "last_seen_at",
        type: "timestamp with time zone",
        isNullable: true
      })
    ]);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_usage_package" ON "file_usage" ("package_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_file_usage_user" ON "file_usage" ("user_id")`);

    await queryRunner.query(`
      CREATE TABLE "storage_limit" (
        "group" varchar(16) PRIMARY KEY,
        "user_quota_bytes" bigint NULL,
        "package_bytes" bigint NULL,
        "image_bytes" bigint NULL,
        "audio_bytes" bigint NULL,
        "video_bytes" bigint NULL,
        "updated_at" timestamp with time zone NOT NULL DEFAULT now()
      )`);
    // Guests only ever store an avatar; admins have no limits.
    await queryRunner.query(
      `INSERT INTO "storage_limit" ("group", "user_quota_bytes", "package_bytes", "image_bytes", "audio_bytes", "video_bytes") VALUES
        ('guest', $1, 0, $2, 0, 0),
        ('user', $3, $4, $5, $6, $7),
        ('moderator', $3, $4, $5, $6, $7),
        ('admin', NULL, NULL, NULL, NULL, NULL)`,
      [20 * MB, 5 * MB, 1 * GB, 500 * MB, 10 * MB, 20 * MB, 100 * MB]
    );

    await queryRunner.query(`INSERT INTO "permission" (name) VALUES ('manage_storage');`);
    await queryRunner.query(
      `INSERT INTO "user_permissions" ("user_id", "permission_id")
       SELECT up."user_id", ms."id"
       FROM "user_permissions" up
       JOIN "permission" mp ON mp."id" = up."permission_id" AND mp."name" = 'manage_permissions'
       CROSS JOIN (SELECT "id" FROM "permission" WHERE "name" = 'manage_storage') ms
       ON CONFLICT DO NOTHING;`
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.26.0 - Added storage limits", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "permission" WHERE name = 'manage_storage';`);
    await queryRunner.query(`DROP TABLE "storage_limit"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_file_usage_package"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_file_usage_user"`);
    await queryRunner.dropColumns("user", ["storage_quota_bytes", "last_seen_at"]);
    await queryRunner.dropColumns("file", ["size", "size_verified_at"]);
  }
}
