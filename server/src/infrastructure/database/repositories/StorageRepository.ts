import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { StorageGroup } from "domain/types/storage/StorageTypes";
import { Database } from "infrastructure/database/Database";
import { StorageLimit } from "infrastructure/database/models/StorageLimit";

/** A stored file as quota counts it: one row per MD5. */
export interface StoredFileSize {
  filename: string;
  size: number | null;
}

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
    const rows: { filename: string; size: string }[] = await this.ds.query(
      `SELECT "filename", MAX("size") AS "size" FROM "file"
       WHERE "filename" = ANY($1) AND "size" IS NOT NULL GROUP BY "filename"`,
      [filenames]
    );
    return new Map(rows.map((r) => [r.filename, Number(r.size)]));
  }

  /** Which of these MD5s already have a file row (and so are, or will be, stored). */
  public async getKnownFilenames(filenames: string[]): Promise<Set<string>> {
    if (filenames.length === 0) return new Set();
    const rows: { filename: string }[] = await this.ds.query(
      `SELECT DISTINCT "filename" FROM "file" WHERE "filename" = ANY($1)`,
      [filenames]
    );
    return new Set(rows.map((r) => r.filename));
  }

  /** Records sizes the uploader declared, without overwriting a size read from storage. */
  public async setDeclaredSizes(sizes: Map<string, number>): Promise<void> {
    for (const [filename, size] of sizes) {
      await this.ds.query(
        `UPDATE "file" SET "size" = $2 WHERE "filename" = $1 AND "size_verified_at" IS NULL`,
        [filename, size]
      );
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
    await this.ds.query(
      `UPDATE "file" SET "size" = $2, "size_verified_at" = now() WHERE "filename" = $1`,
      [filename, size]
    );
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
    const rows: { filename: string }[] = await this.ds.query(
      `SELECT DISTINCT f."filename" FROM "file_usage" u JOIN "file" f ON f."id" = u."file_id"
       WHERE u."package_id" = $1`,
      [packageId]
    );
    return rows.map((r) => r.filename);
  }

  public async deleteFileRows(filenames: string[]): Promise<void> {
    if (filenames.length === 0) return;
    await this.ds.query(`DELETE FROM "file" WHERE "filename" = ANY($1)`, [filenames]);
  }

  /** Files whose size came from the uploader only, oldest first. */
  public async getUnverifiedFilenames(limit: number, userId?: number): Promise<string[]> {
    const rows: { filename: string }[] =
      userId === undefined
        ? await this.ds.query(
            `SELECT DISTINCT "filename" FROM "file" WHERE "size_verified_at" IS NULL LIMIT $1`,
            [limit]
          )
        : await this.ds.query(
            `SELECT t."filename" FROM (${USER_FILES_SQL}) t
             WHERE EXISTS (SELECT 1 FROM "file" f WHERE f."filename" = t."filename" AND f."size_verified_at" IS NULL)
             LIMIT $3`,
            [userId, null, limit]
          );
    return rows.map((r) => r.filename);
  }

  public async touchLastSeen(userId: number): Promise<void> {
    await this.ds.query(
      `UPDATE "user" SET "last_seen_at" = now()
       WHERE "id" = $1 AND ("last_seen_at" IS NULL OR "last_seen_at" < now() - interval '1 hour')`,
      [userId]
    );
  }

  /** Guests not seen since `before`, with whether they appear in any game's statistics (kept for history). */
  public async getInactiveGuests(
    before: Date,
    limit: number
  ): Promise<{ id: number; avatarFilename: string | null; hasGames: boolean }[]> {
    const rows: { id: number; avatar: string | null; has_games: boolean }[] = await this.ds.query(
      `SELECT x."id", f."filename" AS "avatar",
              (EXISTS (SELECT 1 FROM "game_statistics" g WHERE g."created_by" = x."id")
               OR EXISTS (SELECT 1 FROM "player_game_stats" s WHERE s."user_id" = x."id")) AS "has_games"
       FROM "user" x
       LEFT JOIN "file" f ON f."id" = x."avatar"
       WHERE x."is_guest" = true AND x."is_deleted" = false
         AND COALESCE(x."last_seen_at", x."updated_at", x."created_at") < $1
       ORDER BY x."id"
       LIMIT $2`,
      [before, limit]
    );
    return rows.map((r) => ({ id: r.id, avatarFilename: r.avatar, hasGames: r.has_games }));
  }

  /** Removes a guest: deleted outright, or marked deleted when game statistics still point at them. */
  public async removeGuest(id: number, keepRow: boolean): Promise<void> {
    await this.ds.query(`DELETE FROM "file_usage" WHERE "user_id" = $1 AND "package_id" IS NULL`, [id]);
    if (keepRow) {
      await this.ds.query(
        `UPDATE "user" SET "is_deleted" = true, "avatar" = NULL WHERE "id" = $1`,
        [id]
      );
    } else {
      await this.ds.query(`DELETE FROM "user" WHERE "id" = $1`, [id]);
    }
  }

  /** Guest flag and permission names, for working out a user's storage group. */
  public async getUserFacts(
    userId: number
  ): Promise<{ is_guest: boolean; permissions: { name: string }[] }> {
    const [row]: { is_guest: boolean; perms: string[] | null }[] = await this.ds.query(
      `SELECT x."is_guest",
              (SELECT array_agg(p."name") FROM "user_permissions" up
               JOIN "permission" p ON p."id" = up."permission_id"
               WHERE up."user_id" = x."id") AS "perms"
       FROM "user" x WHERE x."id" = $1`,
      [userId]
    );
    return {
      is_guest: row?.is_guest ?? false,
      permissions: (row?.perms ?? []).map((name) => ({ name }))
    };
  }

  public async getUserQuota(userId: number): Promise<number | null> {
    const [row]: { q: string | null }[] = await this.ds.query(
      `SELECT "storage_quota_bytes" AS "q" FROM "user" WHERE "id" = $1`,
      [userId]
    );
    return row?.q == null ? null : Number(row.q);
  }

  public async setUserQuota(userId: number, quota: number | null): Promise<void> {
    await this.ds.query(`UPDATE "user" SET "storage_quota_bytes" = $2 WHERE "id" = $1`, [
      userId,
      quota
    ]);
  }
}
