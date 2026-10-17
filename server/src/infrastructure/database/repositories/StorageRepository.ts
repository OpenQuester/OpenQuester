import { inject, singleton } from "tsyringe";
import { In, IsNull } from "typeorm";

import { DI_TOKENS } from "shared/di/tokens";
import { StorageGroup } from "domain/types/storage/StorageTypes";
import { Database } from "infrastructure/database/Database";
import { File } from "infrastructure/database/models/File";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { StorageLimit } from "infrastructure/database/models/StorageLimit";
import { User } from "infrastructure/database/models/User";
import { type PackageFileState } from "domain/types/file/FileLocation";
import { asUserId } from "domain/types/ids";

/** A stored file as quota counts it: one row per MD5. */
export interface StoredFileSize {
  filename: string;
  size: number | null;
}

/*
 * Most queries below use TypeORM's query builder. A few stay raw SQL because
 * they group by MD5 across file rows with correlated subqueries, EXISTS
 * chains, a LATERAL join or an unnest() bulk update, which the query builder
 * can't express without losing their single-statement plan: USER_FILES_SQL,
 * UNUSED_FILES_SQL, setVerifiedSizes, getBucketUsage, getTopUsers and
 * getPackageFileStates.
 */

/**
 * Every file a user references: files used by packages they wrote, plus
 * their avatar. One row per MD5, so a file used twice counts once.
 */
const USER_FILES_SQL = `
  SELECT f."filename",
         (SELECT MAX(g."size") FROM "file" g WHERE g."filename" = f."filename") AS "size"
  FROM "file_usage" u
  JOIN "file" f ON f."id" = u."file_id"
  LEFT JOIN "package" p ON p."id" = u."package_id"
  WHERE (p."author" = $1 AND ($2::int IS NULL OR p."id" <> $2))
     OR (u."package_id" IS NULL AND u."user_id" = $1)
  GROUP BY f."filename"`;

/** File rows nothing points at: no usage and no package, question, answer or avatar reference. */
const UNUSED_FILES_SQL = `
  SELECT DISTINCT f."filename"
  FROM "file" f
  WHERE f."created_at" < $1
    AND NOT EXISTS (
      SELECT 1 FROM "file" g JOIN "file_usage" u ON u."file_id" = g."id"
      WHERE g."filename" = f."filename")
    AND NOT EXISTS (
      SELECT 1 FROM "file" g WHERE g."filename" = f."filename" AND (
        EXISTS (SELECT 1 FROM "user" x WHERE x."avatar" = g."id")
        OR EXISTS (SELECT 1 FROM "package" x WHERE x."logo_file" = g."id")
        OR EXISTS (SELECT 1 FROM "package_question_file" x WHERE x."file" = g."id")
        OR EXISTS (SELECT 1 FROM "package_answer_file" x WHERE x."file" = g."id")
        OR EXISTS (SELECT 1 FROM "package_question_choice_answer" x WHERE x."file" = g."id")))`;

@singleton()
export class StorageRepository {
  constructor(@inject(DI_TOKENS.Database) private readonly db: Database) {
    //
  }

  private get ds() {
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
    const rows: { filename: string; size: string | null }[] = await this.ds.query(
      USER_FILES_SQL,
      [userId, excludePackageId ?? null]
    );

    return rows.map((r) => ({ filename: r.filename, size: r.size === null ? null : Number(r.size) }));
  }

  /** Known sizes for these MD5s, whoever uploaded them. */
  public async getSizes(filenames: string[]): Promise<Map<string, number>> {
    if (filenames.length === 0) return new Map();

    const rows = await this.ds
      .getRepository(File)
      .createQueryBuilder("file")
      .select("file.filename", "filename")
      .addSelect("MAX(file.size)", "size")
      .where("file.filename IN (:...filenames)", { filenames })
      .andWhere("file.size IS NOT NULL")
      .groupBy("file.filename")
      .getRawMany<{ filename: string; size: string }>();

    return new Map(rows.map((r) => [r.filename, Number(r.size)]));
  }

  /** Which of these MD5s already have a file row (and so are, or will be, stored). */
  public async getKnownFilenames(filenames: string[]): Promise<Set<string>> {
    if (filenames.length === 0) return new Set();

    const rows = await this.ds
      .getRepository(File)
      .createQueryBuilder("file")
      .select("DISTINCT file.filename", "filename")
      .where("file.filename IN (:...filenames)", { filenames })
      .getRawMany<{ filename: string }>();

    return new Set(rows.map((r) => r.filename));
  }

  /** Records sizes the uploader declared, without overwriting a size read from storage. */
  public async setDeclaredSizes(sizes: Map<string, number>): Promise<void> {
    for (const [filename, size] of sizes) {
      await this.ds
        .getRepository(File)
        .update({ filename, size_verified_at: IsNull() }, { size });
    }
  }

  /** Sizes read from a bucket listing; rows already correct are left alone. */
  public async setVerifiedSizes(sizes: Map<string, number>): Promise<void> {
    if (sizes.size === 0) return;

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
  public async getBucketUsage(): Promise<{ usedBytes: number; fileCount: number }> {
    const [row]: { used: string | null; count: string }[] = await this.ds.query(
      `SELECT COALESCE(SUM(s), 0) AS "used", COUNT(*) AS "count"
       FROM (SELECT MAX("size") AS s FROM "file" GROUP BY "filename") t`
    );

    return { usedBytes: Number(row?.used ?? 0), fileCount: Number(row?.count ?? 0) };
  }

  /** Heaviest users by referenced bytes, for the admin page. */
  public async getTopUsers(
    limit: number
  ): Promise<
    { id: number; username: string; usedBytes: number; isGuest: boolean; permissions: string[] }[]
  > {
    const rows: {
      id: number;
      username: string;
      used: string;
      is_guest: boolean;
      perms: string[] | null;
    }[] = await this.ds.query(
      `SELECT x."id", x."username", x."is_guest", COALESCE(SUM(t."size"), 0) AS "used",
              (SELECT array_agg(p."name") FROM "user_permissions" up
               JOIN "permission" p ON p."id" = up."permission_id"
               WHERE up."user_id" = x."id") AS "perms"
       FROM "user" x
       JOIN LATERAL (
         SELECT f."filename",
                (SELECT MAX(g."size") FROM "file" g WHERE g."filename" = f."filename") AS "size"
         FROM "file_usage" u
         JOIN "file" f ON f."id" = u."file_id"
         LEFT JOIN "package" p ON p."id" = u."package_id"
         WHERE p."author" = x."id" OR (u."package_id" IS NULL AND u."user_id" = x."id")
         GROUP BY f."filename"
       ) t ON true
       WHERE x."is_deleted" = false
       GROUP BY x."id", x."username", x."is_guest"
       ORDER BY "used" DESC
       LIMIT $1`,
      [limit]
    );

    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      usedBytes: Number(r.used),
      isGuest: r.is_guest,
      permissions: r.perms ?? []
    }));
  }

  /** MD5s with no usage and no reference, created before `olderThan`. */
  public async getUnusedFilenames(olderThan: Date): Promise<string[]> {
    const rows: { filename: string }[] = await this.ds.query(UNUSED_FILES_SQL, [olderThan]);

    return rows.map((r) => r.filename);
  }

  /** Of these MD5s, the ones nothing uses or references any more (no grace period). */
  public async filterUnused(filenames: string[]): Promise<string[]> {
    if (filenames.length === 0) return [];

    const rows: { filename: string }[] = await this.ds.query(
      `${UNUSED_FILES_SQL} AND f."filename" = ANY($2)`,
      [new Date(Date.now() + 60_000), filenames]
    );

    return rows.map((r) => r.filename);
  }

  public async getPackageFilenames(packageId: number): Promise<string[]> {
    const rows = await this.ds
      .getRepository(FileUsage)
      .createQueryBuilder("usage")
      .innerJoin("usage.file", "file")
      .select("DISTINCT file.filename", "filename")
      .where("usage.package_id = :packageId", { packageId })
      .getRawMany<{ filename: string }>();

    return rows.map((r) => r.filename);
  }

  /** Every MD5 the package uses, and whether storage has confirmed it holds that file. */
  public async getPackageFileStates(packageId: number): Promise<PackageFileState[]> {
    const rows: PackageFileState[] = await this.ds.query(
      `SELECT f."filename", MIN(f."path") AS "path",
              BOOL_OR(EXISTS (SELECT 1 FROM "file" g
                              WHERE g."filename" = f."filename" AND g."size_verified_at" IS NOT NULL)) AS "verified"
       FROM "file_usage" u JOIN "file" f ON f."id" = u."file_id"
       WHERE u."package_id" = $1
       GROUP BY f."filename"`,
      [packageId]
    );

    return rows.map((r) => ({
      filename: r.filename,
      path: r.path,
      verified: Boolean(r.verified)
    }));
  }

  public async deleteFileRows(filenames: string[]): Promise<void> {
    if (filenames.length === 0) return;

    await this.ds
      .getRepository(File)
      .createQueryBuilder()
      .delete()
      .where("filename IN (:...filenames)", { filenames })
      .execute();
  }

  /** Files whose size came from the uploader only, oldest first. */
  public async getUnverifiedFilenames(limit: number, userId?: number): Promise<string[]> {
    const rows: { filename: string }[] =
      userId === undefined
        ? await this.ds
            .getRepository(File)
            .createQueryBuilder("file")
            .select("DISTINCT file.filename", "filename")
            .where("file.size_verified_at IS NULL")
            .limit(limit)
            .getRawMany<{ filename: string }>()
        : await this.ds.query(
            `SELECT t."filename" FROM (${USER_FILES_SQL}) t
             WHERE EXISTS (SELECT 1 FROM "file" f WHERE f."filename" = t."filename" AND f."size_verified_at" IS NULL)
             LIMIT $3`,
            [userId, null, limit]
          );
    return rows.map((r) => r.filename);
  }

  /** Records that the user was around, at most once an hour. */
  public async touchLastSeen(userId: number): Promise<void> {
    await this.ds
      .getRepository(User)
      .createQueryBuilder()
      .update()
      .set({ last_seen_at: () => "now()" })
      .where("id = :userId", { userId })
      .andWhere("(last_seen_at IS NULL OR last_seen_at < now() - interval '1 hour')")
      .execute();
  }

  /** Guests not seen since `before`, with whether they appear in any game's statistics (kept for history). */
  public async getInactiveGuests(
    before: Date,
    limit: number
  ): Promise<{ id: number; avatarFilename: string | null; hasGames: boolean }[]> {
    const rows = await this.ds
      .getRepository(User)
      .createQueryBuilder("guest")
      .leftJoin("guest.avatar", "avatar")
      .select("guest.id", "id")
      .addSelect("avatar.filename", "avatar")
      .addSelect(
        `(EXISTS (SELECT 1 FROM "game_statistics" g WHERE g."created_by" = guest.id)
          OR EXISTS (SELECT 1 FROM "player_game_stats" s WHERE s."user_id" = guest.id))`,
        "has_games"
      )
      .where("guest.is_guest = true")
      .andWhere("guest.is_deleted = false")
      .andWhere("COALESCE(guest.last_seen_at, guest.updated_at, guest.created_at) < :before", {
        before
      })
      .orderBy("guest.id")
      .limit(limit)
      .getRawMany<{ id: number; avatar: string | null; has_games: boolean }>();

    return rows.map((r) => ({ id: r.id, avatarFilename: r.avatar, hasGames: r.has_games }));
  }

  /**
   * Removes guests in one go: `deleteIds` are deleted outright, `keepIds` are
   * marked deleted because game statistics still point at them.
   */
  public async removeGuests(deleteIds: number[], keepIds: number[]): Promise<void> {
    const ids = [...deleteIds, ...keepIds];

    if (ids.length === 0) {
      return;
    }

    // Their avatar usage; usages through packages belong to the packages
    await this.ds
      .getRepository(FileUsage)
      .createQueryBuilder()
      .delete()
      .where("user_id IN (:...ids)", { ids })
      .andWhere("package_id IS NULL")
      .execute();

    if (keepIds.length > 0) {
      await this.ds
        .getRepository(User)
        .update({ id: In(keepIds.map(asUserId)) }, { is_deleted: true, avatar: null });
    }

    if (deleteIds.length > 0) {
      await this.ds.getRepository(User).delete({ id: In(deleteIds.map(asUserId)) });
    }
  }

  /** Guest flag and permission names, for working out a user's storage group. */
  public async getUserFacts(
    userId: number
  ): Promise<{ is_guest: boolean; permissions: { name: string }[] }> {
    const user = await this.ds.getRepository(User).findOne({
      where: { id: asUserId(userId) },
      select: { id: true, is_guest: true, permissions: { id: true, name: true } },
      relations: { permissions: true }
    });

    return {
      is_guest: user?.is_guest ?? false,
      permissions: (user?.permissions ?? []).map((permission) => ({ name: permission.name }))
    };
  }

  public async getUserQuota(userId: number): Promise<number | null> {
    const user = await this.ds.getRepository(User).findOne({
      where: { id: asUserId(userId) },
      select: { id: true, storage_quota_bytes: true }
    });

    return user?.storage_quota_bytes == null ? null : Number(user.storage_quota_bytes);
  }

  public async setUserQuota(userId: number, quota: number | null): Promise<void> {
    await this.ds.getRepository(User).update({ id: asUserId(userId) }, { storage_quota_bytes: quota });
  }
}
