import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPackagePublishingFields_0_24_0_1788489600000 implements MigrationInterface {
  name = "AddPackagePublishingFields_0_24_0_1788489600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "package_status_enum" AS ENUM ('draft', 'published')`);
    await queryRunner.query(
      `ALTER TABLE "package" ADD "status" "package_status_enum" NOT NULL DEFAULT 'published'`
    );
    await queryRunner.query(
      `ALTER TABLE "package" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_package_status_updated_at" ON "package" ("status", "updated_at")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_package_status_updated_at"`);
    await queryRunner.query(`ALTER TABLE "package" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "package" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "package_status_enum"`);
  }
}
