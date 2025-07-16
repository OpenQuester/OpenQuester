import { MigrationInterface, QueryRunner } from "typeorm";

import { Logger } from "infrastructure/utils/Logger";

export class AddSearchIndexes_0_15_3_1752686138751
  implements MigrationInterface
{
  name = "AddSearchIndexes_0_15_3_1752686138751";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pg_trgm extension for trigram indexes (case-insensitive text search)
    await queryRunner.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");

    // Package table indexes for search optimization

    // Trigram index for package title - enables efficient ILike wildcard searches
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_title_trgm ON package USING gin (title gin_trgm_ops)"
    );

    // Index for package created_at - improves sorting performance
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_created_at ON package (created_at)"
    );

    // Composite index for author + created_at - optimizes author-based package listings
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_author_created_at ON package (author, created_at)"
    );

    // Index for age_restriction - improves filtering performance
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_age_restriction ON package (age_restriction)"
    );

    // User table indexes for search optimization

    // Index for user created_at - improves pagination sorting
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_user_created_at ON "user" (created_at)'
    );

    // Index for is_deleted - improves filtering active users
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_user_is_deleted ON "user" (is_deleted)'
    );

    // File table indexes for search optimization

    // Index for filename - improves file lookups
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_file_filename ON file (filename)"
    );

    // Index for source - improves filtering by file source
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_file_source ON file (source)"
    );

    // Index for created_at - improves file listing pagination
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_file_created_at ON file (created_at)"
    );

    // Package tag indexes for search optimization

    // Index for tag name - improves tag-based searches
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_tag_tag ON package_tag (tag)"
    );

    // Junction table indexes (packages_tags)

    // These indexes might already exist due to foreign keys, but we ensure they exist
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_packages_tags_package ON packages_tags (package)"
    );

    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_packages_tags_tag ON packages_tags (tag)"
    );

    // Additional indexes for hierarchical package structure searches

    // Package round indexes
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_round_package ON package_round (package)"
    );

    // Package theme indexes
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_theme_round ON package_theme (round)"
    );

    // Package question indexes
    await queryRunner.query(
      "CREATE INDEX IF NOT EXISTS idx_package_question_theme ON package_question (theme)"
    );

    Logger.logMigrationComplete("0.15.3 - Added search optimization indexes");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all the indexes created in up()

    // Package table indexes
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_title_trgm");
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_created_at");
    await queryRunner.query(
      "DROP INDEX IF EXISTS idx_package_author_created_at"
    );
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_age_restriction");

    // User table indexes
    await queryRunner.query("DROP INDEX IF EXISTS idx_user_created_at");
    await queryRunner.query("DROP INDEX IF EXISTS idx_user_is_deleted");

    // File table indexes
    await queryRunner.query("DROP INDEX IF EXISTS idx_file_filename");
    await queryRunner.query("DROP INDEX IF EXISTS idx_file_source");
    await queryRunner.query("DROP INDEX IF EXISTS idx_file_created_at");

    // Package tag indexes
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_tag_tag");

    // Junction table indexes
    await queryRunner.query("DROP INDEX IF EXISTS idx_packages_tags_package");
    await queryRunner.query("DROP INDEX IF EXISTS idx_packages_tags_tag");

    // Hierarchical structure indexes
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_round_package");
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_theme_round");
    await queryRunner.query("DROP INDEX IF EXISTS idx_package_question_theme");

    // Note: We don't drop the pg_trgm extension as it might be used elsewhere
    Logger.logMigrationComplete("0.15.3 - Removed search optimization indexes");
  }
}
