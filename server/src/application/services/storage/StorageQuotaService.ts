import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { staffRoleOf, StaffRole } from "domain/constants/staffRoles";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { type S3Context } from "domain/types/file/S3Context";
import {
  type AdminStorageDTO,
  type MyStorageDTO,
  StorageGroup,
  type StorageGroupLimits,
  type StorageLimits
} from "domain/types/storage/StorageTypes";
import { StorageLimit } from "infrastructure/database/models/StorageLimit";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { StorageUtils } from "infrastructure/utils/StorageUtils";
import { ValueUtils } from "domain/utils/ValueUtils";
import { Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type ObjectStorage } from "shared/storage/ObjectStorage";

type MediaKind = "image" | "audio" | "video";

/** Uploads stop when the bucket reaches this share of S3_BUCKET_QUOTA_BYTES. */
const BUCKET_HARD_SHARE = 0.95;
/** Unverified sizes checked against storage on each upload, at most. */
const VERIFY_ON_UPLOAD = 50;

/** Minimal user shape: services pass entities with or without relations loaded. */
interface QuotaUser {
  id?: number;
  is_guest?: boolean;
  permissions?: { name: string }[];
}

const NO_LIMITS: StorageLimits = {
  userQuotaBytes: null,
  packageBytes: null,
  imageBytes: null,
  audioBytes: null,
  videoBytes: null
};

/**
 * Storage limits (docs/specs/storage-limits.md). A user's usage is every
 * distinct file their packages and avatar reference; a file shared with
 * other users counts for each of them, while the bucket stores it once.
 */
@singleton()
export class StorageQuotaService {
  constructor(
    private readonly storageRepository: StorageRepository,
    @inject(DI_TOKENS.S3Context) private readonly s3Context: S3Context,
    @inject(DI_TOKENS.ObjectStorage) private readonly objectStorage: ObjectStorage,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  private get env(): Environment {
    return Environment.getInstance(this.logger);
  }

  public groupOf(user: QuotaUser): StorageGroup {
    if (user.is_guest) return StorageGroup.GUEST;
    const role = staffRoleOf((user.permissions ?? []).map((p) => p.name));
    if (role === StaffRole.ADMIN) return StorageGroup.ADMIN;
    if (role === StaffRole.MODERATOR) return StorageGroup.MODERATOR;
    return StorageGroup.USER;
  }

  public async getGroupLimits(group: StorageGroup): Promise<StorageLimits> {
    const row = await this.storageRepository.getLimit(group);
    return row ? toLimits(row) : NO_LIMITS;
  }

  /** The group's limits with the user's own quota applied. */
  public async getLimitsFor(
    user: QuotaUser
  ): Promise<{ group: StorageGroup; limits: StorageLimits; overridden: boolean }> {
    if (user.id && (user.permissions === undefined || user.is_guest === undefined)) {
      const facts = await this.storageRepository.getUserFacts(user.id);
      user = { ...user, ...facts };
    }
    const group = this.groupOf(user);
    const limits = { ...(await this.getGroupLimits(group)) };
    const own = user.id ? await this.storageRepository.getUserQuota(user.id) : null;
    if (own !== null) limits.userQuotaBytes = own;
    return { group, limits, overridden: own !== null };
  }

  public async getUsage(userId: number, excludePackageId?: number): Promise<number> {
    const files = await this.storageRepository.getUserFiles(userId, excludePackageId);
    return files.reduce((n, f) => n + (f.size ?? 0), 0);
  }

  public async getMyStorage(user: QuotaUser): Promise<MyStorageDTO> {
    const { group, limits, overridden } = await this.getLimitsFor(user);
    return {
      group,
      usedBytes: user.id ? await this.getUsage(user.id) : 0,
      quotaBytes: limits.userQuotaBytes,
      quotaOverridden: overridden,
      limits
    };
  }

  /**
   * Throws 413 when a package (new, or replacing `replaceId`) breaks a file,
   * package or user limit, and 507 when the bucket is full. `declared` holds
   * the sizes the client sent; files already in storage use their known size.
   */
  public async assertPackageFits(
    user: QuotaUser,
    content: PackageDTO,
    declared: Record<string, number> | undefined,
    replaceId?: number
  ): Promise<Map<string, number>> {
    const kinds = collectFiles(content);
    const md5s = [...kinds.keys()];
    const known = await this.storageRepository.getSizes(md5s);
    const sizes = new Map<string, number>();
    for (const md5 of md5s) {
      const raw = ValueUtils.getRawFilename(md5);
      const size = known.get(md5) ?? declared?.[raw] ?? declared?.[md5];
      if (typeof size === "number" && Number.isFinite(size) && size >= 0) sizes.set(md5, size);
    }
    const declaredOnly = new Map(
      [...sizes].filter(([md5]) => !known.has(md5) && declared !== undefined)
    );

    if (!user.id) return declaredOnly;
    await this.verifyUserFiles(user.id);
    const { limits } = await this.getLimitsFor(user);

    for (const [md5, kind] of kinds) {
      const size = sizes.get(md5);
      const limit = limits[`${kind}Bytes`];
      if (size !== undefined && limit !== null && size > limit) {
        throw new ClientError(ClientResponse.STORAGE_FILE_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE, {
          kind,
          size: formatBytes(size),
          limit: formatBytes(limit)
        });
      }
    }

    const packageBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
    if (limits.packageBytes !== null && packageBytes > limits.packageBytes) {
      throw new ClientError(ClientResponse.STORAGE_PACKAGE_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE, {
        size: formatBytes(packageBytes),
        limit: formatBytes(limits.packageBytes)
      });
    }

    if (limits.userQuotaBytes !== null) {
      const others = await this.storageRepository.getUserFiles(user.id, replaceId);
      const total = new Map(others.map((f) => [f.filename, f.size ?? 0]));
      for (const [md5, size] of sizes) total.set(md5, Math.max(size, total.get(md5) ?? 0));
      const used = [...total.values()].reduce((a, b) => a + b, 0);
      if (used > limits.userQuotaBytes) {
        throw new ClientError(ClientResponse.STORAGE_QUOTA_EXCEEDED, HttpStatus.PAYLOAD_TOO_LARGE, {
          size: formatBytes(used),
          limit: formatBytes(limits.userQuotaBytes)
        });
      }
    }

    await this.assertBucketHasRoom(user, md5s, sizes);
    return declaredOnly;
  }

  /** Avatars: the picture is already stored, so its real size is checked. */
  public async assertAvatarFits(user: QuotaUser, filename: string): Promise<void> {
    const size = await this.verifyFile(filename);
    if (size === null || !user.id) return;
    const { limits } = await this.getLimitsFor(user);
    if (limits.imageBytes !== null && size > limits.imageBytes) {
      throw new ClientError(ClientResponse.STORAGE_FILE_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE, {
        kind: "image",
        size: formatBytes(size),
        limit: formatBytes(limits.imageBytes)
      });
    }
    if (limits.userQuotaBytes !== null) {
      const files = await this.storageRepository.getUserFiles(user.id);
      const used =
        files.filter((f) => f.filename !== filename).reduce((n, f) => n + (f.size ?? 0), 0) + size;
      if (used > limits.userQuotaBytes) {
        throw new ClientError(ClientResponse.STORAGE_QUOTA_EXCEEDED, HttpStatus.PAYLOAD_TOO_LARGE, {
          size: formatBytes(used),
          limit: formatBytes(limits.userQuotaBytes)
        });
      }
    }
  }

  private async assertBucketHasRoom(
    user: QuotaUser,
    md5s: string[],
    sizes: Map<string, number>
  ): Promise<void> {
    const quota = this.env.S3_BUCKET_QUOTA_BYTES;
    if (!quota || (await this.getLimitsFor(user)).group === StorageGroup.ADMIN) return;
    const stored = await this.storageRepository.getKnownFilenames(md5s);
    const incoming = md5s.filter((m) => !stored.has(m)).reduce((n, m) => n + (sizes.get(m) ?? 0), 0);
    const { usedBytes } = await this.storageRepository.getBucketUsage();
    if (usedBytes + incoming > quota * BUCKET_HARD_SHARE) {
      this.logger.warn("Upload refused: storage bucket is full", {
        prefix: LogPrefix.S3,
        usedBytes,
        incoming,
        quota
      });
      throw new ClientError(ClientResponse.STORAGE_FULL, HttpStatus.INSUFFICIENT_STORAGE);
    }
  }

  /** Reads the real size of a stored file and records it; null when it isn't stored. */
  public async verifyFile(filename: string): Promise<number | null> {
    const head = await this.objectStorage.headObject(
      this.s3Context.bucket,
      StorageUtils.parseFilePath(filename)
    );
    if (head) await this.storageRepository.setVerifiedSize(filename, head.size);
    return head?.size ?? null;
  }

  /** Confirms a few of the user's declared sizes, so a false declaration is caught on the next upload. */
  private async verifyUserFiles(userId: number): Promise<void> {
    const pending = await this.storageRepository.getUnverifiedFilenames(VERIFY_ON_UPLOAD, userId);
    for (const filename of pending) {
      try {
        await this.verifyFile(filename);
      } catch (error) {
        this.logger.warn("Could not read a stored file's size", {
          prefix: LogPrefix.S3,
          filename,
          error: error instanceof Error ? error.message : String(error)
        });
        return;
      }
    }
  }

  public async getAdminStorage(): Promise<AdminStorageDTO> {
    const [bucket, rows, top] = await Promise.all([
      this.storageRepository.getBucketUsage(),
      this.storageRepository.getLimits(),
      this.storageRepository.getTopUsers(20)
    ]);
    const groups = Object.values(StorageGroup).map(
      (group): StorageGroupLimits => {
        const row = rows.find((r) => r.group === group);
        return { group, ...(row ? toLimits(row) : NO_LIMITS) };
      }
    );
    const topUsers = await Promise.all(
      top.map(async (u) => {
        const quota = await this.storageRepository.getUserQuota(u.id);
        const group = this.groupOf({
          is_guest: u.isGuest,
          permissions: u.permissions.map((name) => ({ name }))
        });
        const groupQuota = groups.find((g) => g.group === group)?.userQuotaBytes ?? null;
        return {
          id: u.id,
          username: u.username,
          usedBytes: u.usedBytes,
          group,
          quotaBytes: quota ?? groupQuota,
          quotaOverridden: quota !== null
        };
      })
    );
    return {
      bucket: { ...bucket, quotaBytes: this.env.S3_BUCKET_QUOTA_BYTES || null },
      groups,
      topUsers
    };
  }

  public async setGroupLimits(group: StorageGroup, limits: StorageLimits): Promise<StorageGroupLimits> {
    const row = (await this.storageRepository.getLimit(group)) ?? new StorageLimit();
    row.group = group;
    row.user_quota_bytes = limits.userQuotaBytes;
    row.package_bytes = limits.packageBytes;
    row.image_bytes = limits.imageBytes;
    row.audio_bytes = limits.audioBytes;
    row.video_bytes = limits.videoBytes;
    const saved = await this.storageRepository.saveLimit(row);
    this.logger.audit("Storage limits changed", { prefix: LogPrefix.ADMIN, group, limits });
    return { group, ...toLimits(saved) };
  }

  public async setUserQuota(userId: number, quotaBytes: number | null): Promise<void> {
    await this.storageRepository.setUserQuota(userId, quotaBytes);
    this.logger.audit("User storage quota changed", { prefix: LogPrefix.ADMIN, userId, quotaBytes });
  }
}

function toLimits(row: StorageLimit): StorageLimits {
  return {
    userQuotaBytes: row.user_quota_bytes,
    packageBytes: row.package_bytes,
    imageBytes: row.image_bytes,
    audioBytes: row.audio_bytes,
    videoBytes: row.video_bytes
  };
}

/** Every file the content references, by its name as stored (an MD5, sometimes with an extension), with its media kind. */
export function collectFiles(content: PackageDTO): Map<string, MediaKind> {
  const out = new Map<string, MediaKind>();
  const add = (file: { md5?: string; type?: string } | null | undefined) => {
    if (!file?.md5) return;
    const kind = file.type === "audio" || file.type === "video" ? file.type : "image";
    out.set(file.md5, kind);
  };
  add(content.logo?.file);
  for (const round of content.rounds ?? [])
    for (const theme of round.themes ?? [])
      for (const q of theme.questions ?? []) {
        for (const f of q.questionFiles ?? []) add(f.file);
        for (const f of q.answerFiles ?? []) add(f.file);
        for (const a of (q as { answers?: { file?: { md5?: string; type?: string } | null }[] }).answers ?? [])
          add(a.file);
      }
  return out;
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2).replace(/\.?0+$/, "")} GB`;
}
