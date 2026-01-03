import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class AddTypeColumnForChoiceFile_1743660505666
  implements MigrationInterface
{
  name = "AddTypeColumnForChoiceFile_1743660505666";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question_choice_answer",
      new TableColumn({
        name: "type",
        type: "enum",
        enum: ["video", "audio", "image"],
        isNullable: true,
      })
    );

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.9.7-5", { prefix: LogPrefix.MIGRATION });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question_choice_answer", "type");
  }
}
