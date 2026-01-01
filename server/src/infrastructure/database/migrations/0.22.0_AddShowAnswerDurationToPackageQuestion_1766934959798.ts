import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddShowAnswerDurationToPackageQuestion_0_22_0_1766934959798
  implements MigrationInterface
{
  name = "AddShowAnswerDurationToPackageQuestion_0_22_0_1766934959798";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({
        name: "show_answer_duration",
        type: "int",
        isNullable: false,
        default: 5000, // Default to 5 seconds (text/image duration)
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "show_answer_duration");
  }
}
