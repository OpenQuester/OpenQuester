import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class ChangePackageModel_0_9_7_1739806266677
  implements MigrationInterface
{
  name = "ChangePackageModel_0_9_7_1739806266677";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("TRUNCATE file_usage CASCADE");
    await queryRunner.query("TRUNCATE package CASCADE");
    await queryRunner.query("TRUNCATE file CASCADE");

    // Create new tables
    await queryRunner.createTable(
      new Table({
        name: "package_tag",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "tag", type: "varchar" },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: "package_round",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "package", type: "int", isNullable: false },
          { name: "name", type: "varchar", isNullable: false },
          { name: "description", type: "text", isNullable: true },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: "package_theme",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "round", type: "int", isNullable: false },
          { name: "name", type: "varchar", isNullable: false },
          { name: "description", type: "text", isNullable: true },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: "package_question",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "theme", type: "int", isNullable: false },
          { name: "price", type: "int", isNullable: false },
          {
            name: "type",
            type: "enum",
            enum: ["simple", "stake", "secret", "noRisk", "hidden", "choice"],
          },
          { name: "is_hidden", type: "boolean", default: false },
          { name: "text", type: "text", isNullable: true },
          { name: "answer_hint", type: "text", isNullable: true },
          { name: "answer_text", type: "text", isNullable: true },
          { name: "answer_delay", type: "int", isNullable: true },
          { name: "question_comment", type: "text", isNullable: true },
          { name: "sub_type", type: "varchar", isNullable: true },
          { name: "max_price", type: "int", isNullable: true },
          {
            name: "allowed_prices",
            type: "int",
            isArray: true,
            isNullable: true,
          },
          {
            name: "transfer_type",
            type: "enum",
            enum: ["any", "exceptCurrent"],
            isNullable: true,
          },
          {
            name: "price_multiplier",
            type: "decimal",
            precision: 6,
            scale: 3,
            isNullable: true,
          },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: "package_question_file",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "question", type: "int" },
          { name: "file", type: "int" },
          {
            name: "type",
            type: "enum",
            enum: ["video", "audio", "image"],
          },
          { name: "display_time", type: "int" },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: "package_answer_file",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "question", type: "int" },
          { name: "file", type: "int" },
          {
            name: "type",
            type: "enum",
            enum: ["video", "audio", "image"],
          },
          { name: "display_time", type: "int" },
        ],
      }),
      true
    );

    await queryRunner.createTable(
      new Table({
        name: "packages_tags",
        columns: [
          { name: "package", type: "int", isPrimary: true },
          { name: "tag", type: "int", isPrimary: true },
        ],
      }),
      true
    );

    await queryRunner.addColumn(
      "package",
      new TableColumn({
        name: "language",
        type: "varchar",
        isNullable: true,
      })
    );
    await queryRunner.addColumn(
      "package",
      new TableColumn({
        name: "description",
        type: "text",
        isNullable: true,
      })
    );
    await queryRunner.addColumn(
      "package",
      new TableColumn({
        name: "age_restriction",
        type: "enum",
        enum: ["NONE", "A18", "A16", "A12"],
        isNullable: false,
        default: "'NONE'",
      })
    );
    await queryRunner.addColumn(
      "package",
      new TableColumn({
        name: "logo_file",
        type: "int",
        isNullable: true,
      })
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      "package_round",
      new TableForeignKey({
        columnNames: ["package"],
        referencedTableName: "package",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_theme",
      new TableForeignKey({
        columnNames: ["round"],
        referencedTableName: "package_round",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_question",
      new TableForeignKey({
        columnNames: ["theme"],
        referencedTableName: "package_theme",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_question_file",
      new TableForeignKey({
        columnNames: ["question"],
        referencedTableName: "package_question",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_question_file",
      new TableForeignKey({
        columnNames: ["file"],
        referencedTableName: "file",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_answer_file",
      new TableForeignKey({
        columnNames: ["question"],
        referencedTableName: "package_question",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_answer_file",
      new TableForeignKey({
        columnNames: ["file"],
        referencedTableName: "file",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "packages_tags",
      new TableForeignKey({
        columnNames: ["package"],
        referencedTableName: "package",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "packages_tags",
      new TableForeignKey({
        columnNames: ["tag"],
        referencedTableName: "package_tag",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    // Drop content column
    await queryRunner.dropColumn("package", "content");

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.9.7");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("packages_tags");
    await queryRunner.dropTable("package_answer_file");
    await queryRunner.dropTable("package_question_file");
    await queryRunner.dropTable("package_question");
    await queryRunner.dropTable("package_theme");
    await queryRunner.dropTable("package_round");
    await queryRunner.dropTable("package_tag");

    await queryRunner.dropColumn("package", "title");
    await queryRunner.dropColumn("package", "language");
    await queryRunner.dropColumn("package", "description");
    await queryRunner.dropColumn("package", "age_restriction");
    await queryRunner.dropColumn("package", "logo_file");
  }
}
