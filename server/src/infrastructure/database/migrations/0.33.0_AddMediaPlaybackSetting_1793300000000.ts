import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddMediaPlaybackSetting_0_33_0_1793300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "package_question",
      new TableColumn({ name: "play_media_simultaneously", type: "boolean", default: true })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("package_question", "play_media_simultaneously");
  }
}
