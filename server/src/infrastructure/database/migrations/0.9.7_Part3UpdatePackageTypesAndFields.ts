import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class UpdatePackageTypesAndFields_1742727260372
  implements MigrationInterface
{
  private readonly PACKAGE_FILE_TYPE_ENUM = "package_file_type_enum";
  private readonly OLD_PACKAGE_LOGO_FILE_TYPE_ENUM =
    "package_logo_file_type_enum";
  private readonly OLD_PACKAGE_QUESTION_FILE_TYPE_ENUM =
    "package_question_file_type_enum";
  private readonly OLD_PACKAGE_ANSWER_FILE_TYPE_ENUM =
    "package_answer_file_type_enum";

  name = "UpdatePackageTypesAndFields_1742727260372";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing type if it exists before creating a new one
    await queryRunner.query(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '${this.PACKAGE_FILE_TYPE_ENUM}') THEN
           DROP TYPE ${this.PACKAGE_FILE_TYPE_ENUM};
         END IF;
       END $$;`
    );

    await queryRunner.query(
      `CREATE TYPE ${this.PACKAGE_FILE_TYPE_ENUM} AS ENUM ('video', 'audio', 'image')`
    );

    // Alter package_question_file.type
    await queryRunner.query(
      `ALTER TABLE package_question_file ALTER COLUMN type TYPE ${this.PACKAGE_FILE_TYPE_ENUM} USING type::text::${this.PACKAGE_FILE_TYPE_ENUM}`
    );
    // Alter package_answer_file.type
    await queryRunner.query(
      `ALTER TABLE package_answer_file ALTER COLUMN type TYPE ${this.PACKAGE_FILE_TYPE_ENUM} USING type::text::${this.PACKAGE_FILE_TYPE_ENUM}`
    );

    // Add show_delay column to package_question for ChoiceQuestion
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({
        name: "show_delay",
        type: "int",
        isNullable: true,
      })
    );

    // Create table for ChoiceQuestion answers
    await queryRunner.createTable(
      new Table({
        name: "package_question_choice_answer",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "question",
            type: "int",
            isNullable: false,
          },
          {
            name: "text",
            type: "text",
            isNullable: true,
          },
          {
            name: "file",
            type: "int",
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Add foreign keys for package_question_choice_answer
    await queryRunner.createForeignKey(
      "package_question_choice_answer",
      new TableForeignKey({
        columnNames: ["question"],
        referencedTableName: "package_question",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createForeignKey(
      "package_question_choice_answer",
      new TableForeignKey({
        columnNames: ["file"],
        referencedTableName: "file",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.9.7-3", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the package_question_choice_answer table
    await queryRunner.dropTable("package_question_choice_answer");

    // Remove show_delay column
    await queryRunner.dropColumn("package_question", "show_delay");

    // Recreate the original separate enum types
    const dropTypeIfExists = async (typeName: string) => {
      await queryRunner.query(
        `DO $$ BEGIN
           IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
             DROP TYPE ${typeName};
           END IF;
         END $$;`
      );
    };

    await dropTypeIfExists(this.OLD_PACKAGE_LOGO_FILE_TYPE_ENUM);
    await queryRunner.query(
      `CREATE TYPE ${this.OLD_PACKAGE_LOGO_FILE_TYPE_ENUM} AS ENUM ('video', 'audio', 'image')`
    );

    await dropTypeIfExists(this.OLD_PACKAGE_QUESTION_FILE_TYPE_ENUM);
    await queryRunner.query(
      `CREATE TYPE ${this.OLD_PACKAGE_QUESTION_FILE_TYPE_ENUM} AS ENUM ('video', 'audio', 'image')`
    );

    await dropTypeIfExists(this.OLD_PACKAGE_ANSWER_FILE_TYPE_ENUM);
    await queryRunner.query(
      `CREATE TYPE ${this.OLD_PACKAGE_ANSWER_FILE_TYPE_ENUM} AS ENUM ('video', 'audio', 'image')`
    );

    // Revert columns to their original enum types
    await queryRunner.query(
      `ALTER TABLE package_question_file ALTER COLUMN type TYPE ${this.OLD_PACKAGE_QUESTION_FILE_TYPE_ENUM} USING type::text::${this.OLD_PACKAGE_QUESTION_FILE_TYPE_ENUM}`
    );
    await queryRunner.query(
      `ALTER TABLE package_answer_file ALTER COLUMN type TYPE ${this.OLD_PACKAGE_ANSWER_FILE_TYPE_ENUM} USING type::text::${this.OLD_PACKAGE_ANSWER_FILE_TYPE_ENUM}`
    );

    // Drop the new general enum type
    await dropTypeIfExists(this.PACKAGE_FILE_TYPE_ENUM);
  }
}
