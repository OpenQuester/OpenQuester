import { inject, singleton } from "tsyringe";
import { Brackets, In, IsNull, type DataSource, type SelectQueryBuilder } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import {
  StorageGroup,
  type StorageBucketUsage,
  type StorageUserFacts,
  type StorageUserUsageRecord,
  type StoredFileSize
} from "domain/types/storage/StorageTypes";
import { type StorageFilename, type StorageFileState } from "domain/types/file/StorageFile";
import { asUserId } from "domain/types/ids";
import { type GuestCleanupBatch, type InactiveGuest } from "domain/types/storage/GuestCleanupTypes";
import { Database } from "infrastructure/database/Database";
import { StorageLimit } from "infrastructure/database/models/StorageLimit";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { File } from "infrastructure/database/models/File";
import { User } from "infrastructure/database/models/User";
import { Package } from "infrastructure/database/models/package/Package";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { PackageQuestionFile } from "infrastructure/database/models/package/PackageQuestionFile";
import { PackageAnswerFile } from "infrastructure/database/models/package/PackageAnswerFile";
import { PackageQuestionChoiceAnswer } from "infrastructure/database/models/package/PackageQuestionChoiceAnswer";

interface FileSizeRow {
  filename: string;
  size: string | null;
}

interface BucketUsageRow {
  usedBytes: string;
  fileCount: string;
}

interface UserUsageRow {
  id: number;
  username: string;
  usedBytes: string;
  isGuest: boolean;
}

@singleton()
export class StorageRepository {
  constructor(@inject(DI_TOKENS.Database) private readonly db: Database) {
    //
  }

  private get ds(): DataSource {
    return this.db.dataSource;
  }

  public async getLimits(): Promise<StorageLimit[]> {
    return this.ds.getRepository(StorageLimit).find();
  }

  public async getLimit(group: StorageGroup): Promise<StorageLimit | null> {
    return this.ds.getRepository(StorageLimit).findOne({ where: { group } });
  }

  public async saveLimit(limit: StorageLimit): Promise<StorageLimit> {
    return this.ds.getRepository(StorageLimit).save(limit);
  }

  /** Files the user references, optionally leaving out one package (it is being replaced). */
  public async getUserFiles(userId: number, excludePackageId?: number): Promise<StoredFileSize[]> {
    const query = this.userFilesQuery().where(
      "CASE WHEN usage.package_id IS NULL THEN usage.user_id ELSE package.author END = :userId",
      { userId }
    );
    if (excludePackageId !== undefined) {
      query.andWhere("(usage.package_id IS NULL OR package.id <> :excludePackageId)", {
        excludePackageId
      });
    }

    const rows = await query.getRawMany<FileSizeRow>();

    return rows.map((row) => ({
      filename: row.filename,
      size: row.size === null ? null : Number(row.size)
    }));
  }

  /** Known sizes for these MD5s, whoever uploaded them. */
  public async getSizes(filenames: string[]): Promise<Map<string, number>> {
    if (filenames.length === 0) {
      return new Map();
    }

    const rows = await this.ds
      .getRepository(File)
      .createQueryBuilder("file")
      .select("file.filename", "filename")
      .addSelect("MAX(file.size)", "size")
      .where("file.filename IN (:...filenames)", { filenames })
      .andWhere("file.size IS NOT NULL")
      .groupBy("file.filename")
      .getRawMany<FileSizeRow>();

    return new Map(rows.map((row) => [row.filename, Number(row.size)]));
  }

  /** Which of these MD5s already have a file row (and so are, or will be, stored). */
  public async getKnownFilenames(filenames: string[]): Promise<Set<string>> {
    if (filenames.length === 0) {
      return new Set();
    }

    const rows = await this.ds.getRepository(File).find({
      select: { filename: true },
      where: { filename: In(filenames) }
    });

    return new Set(rows.map((file) => file.filename));
  }

  /** Records sizes the uploader declared, without overwriting a size read from storage. */
  public async setDeclaredSizes(sizes: Map<string, number>): Promise<void> {
    for (const [filename, size] of sizes) {
      await this.ds.getRepository(File).update({ filename, size_verified_at: IsNull() }, { size });
    }
  }

  /** Sizes read from a bucket listing; rows already correct are left alone. */
  public async setVerifiedSizes(sizes: Map<string, number>): Promise<void> {
    if (sizes.size === 0) {
      return;
    }

    // PostgreSQL bulk UPDATE avoids one round trip per listed object. Filename is
    // not unique, so ORM upsert cannot update all duplicate rows for each MD5.
    await this.ds.query(
      `UPDATE "file" f SET "size" = v."size", "size_verified_at" = now()
       FROM unnest($1::text[], $2::bigint[]) AS v("filename", "size")
       WHERE f."filename" = v."filename"
         AND (f."size_verified_at" IS NULL OR f."size" IS DISTINCT FROM v."size")`,
      [[...sizes.keys()], [...sizes.values()]]
    );
  }

  public async setVerifiedSize(filename: string, size: number): Promise<void> {
    await this.ds.getRepository(File).update({ filename }, { size, size_verified_at: new Date() });
  }

  /** Bucket usage as the database knows it: distinct MD5s with a size. */
  public async getBucketUsage(): Promise<StorageBucketUsage> {
    const row = await this.ds
      .createQueryBuilder()
      .select("COALESCE(SUM(files.size), 0)", "usedBytes")
      .addSelect("COUNT(*)", "fileCount")
      .from(
        (query) =>
          query.select("MAX(file.size)", "size").from(File, "file").groupBy("file.filename"),
        "files"
      )
      .getRawOne<BucketUsageRow>();

    return { usedBytes: Number(row?.usedBytes ?? 0), fileCount: Number(row?.fileCount ?? 0) };
  }

  /** Heaviest users by referenced bytes, for the admin page. */
  public async getTopUsers(limit: number): Promise<StorageUserUsageRecord[]> {
    const files = this.userFilesQuery();
    const rows = await this.ds
      .getRepository(User)
      .createQueryBuilder("user")
      .select("user.id", "id")
      .addSelect("user.username", "username")
      .addSelect("user.is_guest", "isGuest")
      .addSelect("COALESCE(SUM(files.size), 0)", "usedBytes")
      .innerJoin(`(${files.getQuery()})`, "files", 'files."userId" = user.id')
      .where("user.is_deleted = false")
      .groupBy("user.id")
      .addGroupBy("user.username")
      .addGroupBy("user.is_guest")
      .orderBy('"usedBytes"', "DESC")
      .limit(limit)
      .getRawMany<UserUsageRow>();
    if (rows.length === 0) {
      return [];
    }

    // Load permissions after grouping, so multiple permissions cannot multiply usage.
    const users = await this.ds.getRepository(User).find({
      select: { id: true, permissions: { id: true, name: true } },
      relations: { permissions: true },
      where: { id: In(rows.map((row) => row.id)) }
    });
    const permissionsByUser = new Map(
      users.map((user) => [user.id, user.permissions.map((permission) => permission.name)])
    );

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      usedBytes: Number(row.usedBytes),
      isGuest: row.isGuest,
      permissions: permissionsByUser.get(asUserId(row.id)) ?? []
    }));
  }

  /** MD5s with no usage and no reference, created before `olderThan`. */
  public async getUnusedFilenames(olderThan: Date): Promise<string[]> {
    const files = await this.unusedFilesQuery()
      .andWhere("file.created_at < :olderThan", { olderThan })
      .getRawMany<StorageFilename>();

    return files.map((file) => file.filename);
  }

  /** Of these MD5s, the ones nothing uses or references any more (no grace period). */
  public async filterUnused(filenames: string[]): Promise<string[]> {
    if (filenames.length === 0) {
      return [];
    }

    const latestCreationTime = new Date(Date.now() + 60_000);
    const files = await this.unusedFilesQuery()
      .andWhere("file.filename IN (:...filenames)", { filenames })
      .andWhere("file.created_at < :latestCreationTime", { latestCreationTime })
      .getRawMany<StorageFilename>();

    return files.map((file) => file.filename);
  }

  public async getPackageFilenames(packageId: number): Promise<string[]> {
    const files = await this.ds
      .getRepository(File)
      .createQueryBuilder("file")
      .innerJoin(FileUsage, "usage", "usage.file = file.id")
      .select("file.filename", "filename")
      .distinct(true)
      .where("usage.package_id = :packageId", { packageId })
      .getRawMany<StorageFilename>();

    return files.map((file) => file.filename);
  }

  /** Every MD5 the package uses, and whether storage has confirmed it holds that file. */
  public async getPackageFileStates(packageId: number): Promise<StorageFileState[]> {
    const query = this.ds
      .getRepository(FileUsage)
      .createQueryBuilder("usage")
      .innerJoin("usage.file", "file")
      .select("file.filename", "filename")
      .addSelect("MIN(file.path)", "path")
      .where("usage.package_id = :packageId", { packageId })
      .groupBy("file.filename");
    const confirmedFile = query
      .subQuery()
      .select("1")
      .from(File, "confirmedFile")
      .where("confirmedFile.filename = file.filename")
      .andWhere("confirmedFile.size_verified_at IS NOT NULL");

    return query
      .addSelect(`EXISTS ${confirmedFile.getQuery()}`, "verified")
      .getRawMany<StorageFileState>();
  }

  public async deleteFileRows(filenames: string[]): Promise<void> {
    if (filenames.length === 0) {
      return;
    }

    await this.ds.getRepository(File).delete({ filename: In(filenames) });
  }

  /** Files whose size came from the uploader only. */
  public async getUnverifiedFilenames(limit: number, userId?: number): Promise<string[]> {
    const query = this.ds
      .getRepository(File)
      .createQueryBuilder("file")
      .select("file.filename", "filename")
      .distinct(true)
      .where("file.size_verified_at IS NULL")
      .limit(limit);
    if (userId !== undefined) {
      const userFiles = this.userFilesQuery().where(
        "CASE WHEN usage.package_id IS NULL THEN usage.user_id ELSE package.author END = :userId",
        { userId }
      );
      query
        .innerJoin(`(${userFiles.getQuery()})`, "userFiles", '"userFiles".filename = file.filename')
        .setParameters(userFiles.getParameters());
    }

    const files = await query.getRawMany<StorageFilename>();

    return files.map((file) => file.filename);
  }

  public async touchLastSeen(userId: number): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    await this.ds
      .getRepository(User)
      .createQueryBuilder()
      .update()
      .set({ last_seen_at: now, updated_at: () => '"updated_at"' })
      .where("id = :userId", { userId })
      .andWhere("(last_seen_at IS NULL OR last_seen_at < :oneHourAgo)", { oneHourAgo })
      .execute();
  }

  /** Removes one batch atomically; retained accounts preserve scores, game history and authorship. */
  public async removeInactiveGuests(before: Date, limit: number): Promise<GuestCleanupBatch> {
    return this.ds.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const hostedGames = manager
        .createQueryBuilder(GameStatistics, "game")
        .select("1")
        .where("game.created_by = guest.id")
        .getQuery();
      const playedGames = manager
        .createQueryBuilder(PlayerGameStats, "stats")
        .select("1")
        .where("stats.user_id = guest.id")
        .getQuery();
      const authoredPackages = manager
        .createQueryBuilder(Package, "package")
        .select("1")
        .where("package.author = guest.id")
        .getQuery();

      const guests = await users
        .createQueryBuilder("guest")
        .select("guest.id", "id")
        .addSelect("avatar.filename", "avatarFilename")
        .addSelect(
          `EXISTS (${hostedGames}) OR EXISTS (${playedGames}) OR EXISTS (${authoredPackages})`,
          "keepAccount"
        )
        .leftJoin("guest.avatar", "avatar")
        .where("guest.is_guest = :isGuest AND guest.is_deleted = :isDeleted", {
          isGuest: true,
          isDeleted: false
        })
        .andWhere("COALESCE(guest.last_seen_at, guest.updated_at, guest.created_at) < :before", {
          before
        })
        .orderBy("guest.id", "ASC")
        .limit(limit)
        .setLock("pessimistic_write", undefined, ["guest"])
        .getRawMany<InactiveGuest>();

      if (guests.length === 0) {
        return { deletedCount: 0, retainedCount: 0, avatarFilenames: [] };
      }

      const guestIds = guests.map((guest) => guest.id);
      const retainedIds = guests.filter((guest) => guest.keepAccount).map((guest) => guest.id);
      const deletedIds = guests.filter((guest) => !guest.keepAccount).map((guest) => guest.id);

      await manager
        .createQueryBuilder()
        .delete()
        .from(FileUsage)
        .where("user_id IN (:...guestIds)", { guestIds })
        .andWhere("package_id IS NULL")
        .execute();

      if (retainedIds.length > 0) {
        await users.update(
          { id: In(retainedIds) },
          { is_deleted: true, avatar: null, updated_at: () => '"updated_at"' }
        );
      }

      if (deletedIds.length > 0) {
        await users.delete({ id: In(deletedIds) });
      }

      return {
        deletedCount: deletedIds.length,
        retainedCount: retainedIds.length,
        avatarFilenames: guests.flatMap((guest) =>
          guest.avatarFilename ? [guest.avatarFilename] : []
        )
      };
    });
  }

  /** Guest flag and permission names, for working out a user's storage group. */
  public async getUserFacts(userId: number): Promise<StorageUserFacts> {
    const user = await this.ds.getRepository(User).findOne({
      select: { id: true, is_guest: true, permissions: { id: true, name: true } },
      relations: { permissions: true },
      where: { id: asUserId(userId) }
    });

    return {
      is_guest: user?.is_guest ?? false,
      permissions: (user?.permissions ?? []).map((permission) => ({ name: permission.name }))
    };
  }

  public async getUserQuota(userId: number): Promise<number | null> {
    const user = await this.ds.getRepository(User).findOne({
      select: { storage_quota_bytes: true },
      where: { id: asUserId(userId) }
    });

    return user?.storage_quota_bytes ?? null;
  }

  public async setUserQuota(userId: number, quota: number | null): Promise<void> {
    await this.ds
      .getRepository(User)
      .createQueryBuilder()
      .update()
      .set({ storage_quota_bytes: quota, updated_at: () => '"updated_at"' })
      .where("id = :userId", { userId })
      .execute();
  }

  /** One file per owner, with the largest known size from any duplicate file row. */
  private userFilesQuery(): SelectQueryBuilder<FileUsage> {
    const ownerId = "CASE WHEN usage.package_id IS NULL THEN usage.user_id ELSE package.author END";

    return this.ds
      .getRepository(FileUsage)
      .createQueryBuilder("usage")
      .innerJoin("usage.file", "file")
      .leftJoin("usage.package", "package")
      .select(ownerId, "userId")
      .addSelect("file.filename", "filename")
      .addSelect(
        (query) =>
          query
            .select("MAX(duplicateFile.size)")
            .from(File, "duplicateFile")
            .where("duplicateFile.filename = file.filename"),
        "size"
      )
      .groupBy(ownerId)
      .addGroupBy("file.filename");
  }

  /** Protect references on every duplicate row, even when legacy file_usage entries are absent. */
  private unusedFilesQuery(): SelectQueryBuilder<File> {
    const query = this.ds
      .getRepository(File)
      .createQueryBuilder("file")
      .select("file.filename", "filename")
      .distinct(true);
    const references = query
      .subQuery()
      .select("1")
      .from(File, "referencedFile")
      .leftJoin(FileUsage, "usage", "usage.file = referencedFile.id")
      .leftJoin(User, "avatarUser", "avatarUser.avatar = referencedFile.id")
      .leftJoin(Package, "logoPackage", "logoPackage.logo = referencedFile.id")
      .leftJoin(PackageQuestionFile, "questionFile", "questionFile.file = referencedFile.id")
      .leftJoin(PackageAnswerFile, "answerFile", "answerFile.file = referencedFile.id")
      .leftJoin(
        PackageQuestionChoiceAnswer,
        "choiceAnswer",
        "choiceAnswer.file = referencedFile.id"
      )
      .where("referencedFile.filename = file.filename")
      .andWhere(
        new Brackets((reference) =>
          reference
            .where("usage.id IS NOT NULL")
            .orWhere("avatarUser.id IS NOT NULL")
            .orWhere("logoPackage.id IS NOT NULL")
            .orWhere("questionFile.id IS NOT NULL")
            .orWhere("answerFile.id IS NOT NULL")
            .orWhere("choiceAnswer.id IS NOT NULL")
        )
      );

    return query.where(`NOT EXISTS ${references.getQuery()}`);
  }
}
