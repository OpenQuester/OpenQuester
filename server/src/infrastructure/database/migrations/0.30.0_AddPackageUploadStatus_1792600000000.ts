import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

/**
 * Packages remember whether all their media reached storage, so one with
 * missing files can't be played and its author can resume the upload.
 * `source_hash` fingerprints the imported file to warn about duplicates.
 */
export class AddPackageUploadStatus_0_30_0_1792600000000 implements MigrationInterface {
  name = "AddPackageUploadStatus_0_30_0_1792600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("package", [
      // Existing packages were playable before this, so they stay ready.
      new TableColumn({ name: "upload_status", type: "varchar", length: "16", default: "'ready'" }),
      new TableColumn({
        name: "upload_started_at",
        type: "timestamp with time zone",
        isNullable: true
      }),
      new TableColumn({ name: "source_hash", type: "varchar", length: "64", isNullable: true })
    ]);
    await queryRunner.createIndex(
      "package",
      new TableIndex({ name: "idx_package_upload_status", columnNames: ["upload_status"] })
    );
    await queryRunner.createIndex(
      "package",
      new TableIndex({ name: "idx_package_source_hash", columnNames: ["source_hash"] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("package", "idx_package_source_hash");
    await queryRunner.dropIndex("package", "idx_package_upload_status");
    await queryRunner.dropColumns("package", ["upload_status", "upload_started_at", "source_hash"]);
  }
}
