import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * SIQ parity: extra right answers, wrong answers, authors and sources on
 * questions, and authors and sources on packages. All optional.
 */
export class AddPackageCreditsAndAnswers_0_27_0_1792300000000 implements MigrationInterface {
  name = "AddPackageCreditsAndAnswers_0_27_0_1792300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const list = (name: string) =>
      new TableColumn({ name, type: "text", isArray: true, isNullable: true });

    await queryRunner.addColumns("package_question", [
      list("right_answers"),
      list("wrong_answers"),
      list("authors"),
      list("sources")
    ]);
    await queryRunner.addColumns("package", [list("authors"), list("sources")]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of ["sources", "authors"]) {
      await queryRunner.dropColumn("package", column);
    }

    for (const column of ["sources", "authors", "wrong_answers", "right_answers"]) {
      await queryRunner.dropColumn("package_question", column);
    }
  }
}
