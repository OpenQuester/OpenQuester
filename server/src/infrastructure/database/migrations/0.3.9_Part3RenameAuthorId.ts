import { MigrationInterface, QueryRunner, TableForeignKey } from "typeorm";

import { PinoLogger } from "infrastructure/logger/PinoLogger";

export class RenameAuthorAndAvatarId_1734207358779
  implements MigrationInterface
{
  name = "RenameAuthorAndAvatarId_1734207358779";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const packageTable = await queryRunner.getTable("package");

    if (packageTable) {
      const foreignKey = packageTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf("authorId") !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey("package", foreignKey);
      }

      await queryRunner.renameColumn("package", "authorId", "author");

      await queryRunner.createForeignKey(
        "package",
        new TableForeignKey({
          columnNames: ["author"],
          referencedTableName: "user",
          referencedColumnNames: ["id"],
          onDelete: "SET NULL",
        })
      );
    }

    const userTable = await queryRunner.getTable("user");

    if (userTable) {
      const foreignKey = userTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf("avatarId") !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey("user", foreignKey);
      }

      await queryRunner.renameColumn("user", "avatarId", "avatar");

      await queryRunner.createForeignKey(
        "user",
        new TableForeignKey({
          columnNames: ["avatar"],
          referencedTableName: "file",
          referencedColumnNames: ["id"],
          onDelete: "SET NULL",
        })
      );
    }

    const logger = await PinoLogger.init({ pretty: true });
    logger.migration("0.3.9-3");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const packageTable = await queryRunner.getTable("package");

    if (packageTable) {
      const foreignKey = packageTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf("author") !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey("package", foreignKey);
      }

      await queryRunner.renameColumn("package", "author", "authorId");

      await queryRunner.createForeignKey(
        "package",
        new TableForeignKey({
          columnNames: ["authorId"],
          referencedTableName: "user",
          referencedColumnNames: ["id"],
          onDelete: "SET NULL",
        })
      );
    }

    const userTable = await queryRunner.getTable("user");

    if (userTable) {
      const foreignKey = userTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf("avatar") !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey("user", foreignKey);
      }

      await queryRunner.renameColumn("user", "avatar", "avatarId");

      await queryRunner.createForeignKey(
        "user",
        new TableForeignKey({
          columnNames: ["avatarId"],
          referencedTableName: "file",
          referencedColumnNames: ["id"],
          onDelete: "SET NULL",
        })
      );
    }
  }
}
