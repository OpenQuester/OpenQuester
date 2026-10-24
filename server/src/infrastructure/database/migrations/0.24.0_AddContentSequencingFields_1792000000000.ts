import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Question content sequencing (SIGame parity): files carry a placement and a
 * waitForFinish flag, and the question text can take a position in the
 * content order. Defaults keep existing packages valid.
 */
export class AddContentSequencingFields_0_24_0_1792000000000 implements MigrationInterface {
  name = "AddContentSequencingFields_0_24_0_1792000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ["package_question_file", "package_answer_file"]) {
      await queryRunner.addColumns(table, [
        new TableColumn({
          name: "placement",
          type: "varchar",
          length: "16",
          isNullable: false,
          default: "'screen'"
        }),
        new TableColumn({
          name: "wait_for_finish",
          type: "boolean",
          isNullable: false,
          default: true
        })
      ]);
    }

    await queryRunner.addColumn(
      "package_question",
      new TableColumn({ name: "text_order", type: "int", isNullable: true })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "text_order");

    for (const table of ["package_question_file", "package_answer_file"]) {
      await queryRunner.dropColumn(table, "wait_for_finish");
      await queryRunner.dropColumn(table, "placement");
    }
  }
}
