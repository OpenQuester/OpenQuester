import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/** SIGame answer types: number and point answers checked by the server */
export class AddAnswerTypes_0_28_0_1792400000000 implements MigrationInterface {
  name = "AddAnswerTypes_0_28_0_1792400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("package_question", [
      new TableColumn({ name: "answer_type", type: "varchar", length: "16", isNullable: true }),
      new TableColumn({ name: "answer_number", type: "double precision", isNullable: true }),
      new TableColumn({ name: "answer_point", type: "jsonb", isNullable: true }),
      new TableColumn({ name: "answer_deviation", type: "double precision", isNullable: true })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ["answer_deviation", "answer_point", "answer_number", "answer_type"]) {
      await queryRunner.dropColumn("package_question", column);
    }
  }
}
