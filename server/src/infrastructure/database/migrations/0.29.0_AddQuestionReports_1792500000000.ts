import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

/** Players can report a wrong or broken question to the package author */
export class AddQuestionReports_0_29_0_1792500000000 implements MigrationInterface {
  name = "AddQuestionReports_0_29_0_1792500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "question_report",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment"
          },
          { name: "package_id", type: "int" },
          { name: "question_id", type: "int" },
          { name: "question_text", type: "text", isNullable: true },
          { name: "user_id", type: "int", isNullable: true },
          { name: "game_id", type: "varchar", isNullable: true },
          { name: "reason", type: "varchar", length: "32" },
          { name: "comment", type: "text", isNullable: true },
          { name: "resolved", type: "boolean", default: false },
          { name: "created_at", type: "timestamp", default: "now()" }
        ],
        foreignKeys: [
          {
            columnNames: ["package_id"],
            referencedTableName: "package",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE"
          },
          {
            columnNames: ["user_id"],
            referencedTableName: "user",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL"
          }
        ]
      })
    );

    await queryRunner.createIndex(
      "question_report",
      new TableIndex({ columnNames: ["package_id", "resolved"] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("question_report");
  }
}
