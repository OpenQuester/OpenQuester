import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { staffRoleOf, StaffRole } from "domain/constants/staffRoles";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { type S3Context } from "domain/types/file/S3Context";
import {
  type AdminStorageDTO,
  type ClientFileSizes,
  type EffectiveStorageLimits,
  type MyStorageDTO,
  StorageGroup,
  type StorageGroupLimits,
  type StorageLimits,
  type StorageQuotaUser
} from "domain/types/storage/StorageTypes";
import { StorageLimit } from "infrastructure/database/models/StorageLimit";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { StorageUtils } from "infrastructure/utils/StorageUtils";
import { ValueUtils } from "domain/utils/ValueUtils";
import { Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type ObjectStorage } from "shared/storage/ObjectStorage";
import {
  PackageMediaLogic,
  type PackageMediaContent
} from "domain/logic/package/PackageMediaLogic";
import { ByteUtils } from "domain/utils/ByteUtils";

/** Uploads stop when the bucket reaches this share of S3_BUCKET_QUOTA_BYTES. */
const BUCKET_HARD_SHARE = 0.95;
/** Unverified sizes checked against storage on each upload, at most. */
const VERIFY_ON_UPLOAD = 50;

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

  public groupOf(user: StorageQuotaUser): StorageGroup {
    if (user.is_guest) {
      return StorageGroup.GUEST;
    }

    const role = staffRoleOf((user.permissions ?? []).map((permission) => permission.name));
    if (role === StaffRole.ADMIN) {
      return StorageGroup.ADMIN;
    }

    if (role === StaffRole.MODERATOR) {
      return StorageGroup.MODERATOR;
    }

    return StorageGroup.USER;
  }

  public async getGroupLimits(group: StorageGroup): Promise<StorageLimits> {
    const row = await this.storageRepository.getLimit(group);

    return row ? this.toLimits(row) : NO_LIMITS;
  }

  /** The group's limits with the user's own quota applied. */
  public async getLimitsFor(user: StorageQuotaUser): Promise<EffectiveStorageLimits> {
    if (user.id && (user.permissions === undefined || user.is_guest === undefined)) {
      const facts = await this.storageRepository.getUserFacts(user.id);
      user = { ...user, ...facts };
    }

    const group = this.groupOf(user);
    const limits = { ...(await this.getGroupLimits(group)) };
    const userQuota = user.id ? await this.storageRepository.getUserQuota(user.id) : null;
    if (userQuota !== null) {
      limits.userQuotaBytes = userQuota;
    }

    return { group, limits, overridden: userQuota !== null };
  }

  public async getUsage(userId: number, excludePackageId?: number): Promise<number> {
    const files = await this.storageRepository.getUserFiles(userId, excludePackageId);

    return files.reduce((total, file) => total + (file.size ?? 0), 0);
  }

  public async getMyStorage(user: StorageQuotaUser): Promise<MyStorageDTO> {
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
   * Throws 413 when a package (new, or replacing `replacePackageId`) breaks a file,
   * package or user limit, and 507 when the bucket is full. `declaredFileSizes` holds
   * the sizes the client sent; files already in storage use their known size.
   */
  public async assertPackageFits(
    user: StorageQuotaUser,
    content: PackageDTO,
    declaredFileSizes: ClientFileSizes | undefined,
    replacePackageId?: number
  ): Promise<Map<string, number>> {
    if (user.id) {
      // Use the storage-confirmed sizes in this upload's file/package checks too.
      await this.verifyUserFiles(user.id);
    }

    const fileKinds = PackageMediaLogic.collectFiles(content);
    const filenames = [...fileKinds.keys()];
    const knownSizes = await this.storageRepository.getSizes(filenames);
    const sizes = new Map<string, number>();

    for (const filename of filenames) {
      const rawFilename = ValueUtils.getRawFilename(filename);
      const size =
        knownSizes.get(filename) ??
        declaredFileSizes?.[rawFilename] ??
        declaredFileSizes?.[filename];
      if (typeof size === "number" && Number.isFinite(size) && size >= 0) {
        sizes.set(filename, size);
      }
    }

    const unverifiedFileSizes = new Map(
      [...sizes].filter(
        ([filename]) => !knownSizes.has(filename) && declaredFileSizes !== undefined
      )
    );

    await this.assertSizesFit(user, fileKinds, sizes, replacePackageId);

    return unverifiedFileSizes;
  }

  /** Final acceptance uses only sizes confirmed by storage, never declarations. */
  public async assertStoredPackageFits(
    user: StorageQuotaUser,
    content: PackageMediaContent,
    packageId: number
  ): Promise<void> {
    const fileKinds = PackageMediaLogic.collectFiles(content);
    const sizes = await this.storageRepository.getSizes([...fileKinds.keys()], true);
    if (sizes.size !== fileKinds.size) {
      throw new ClientError(ClientResponse.PACKAGE_UPLOAD_UNFINISHED, HttpStatus.CONFLICT, {
        missing: fileKinds.size - sizes.size,
        total: fileKinds.size
      });
    }
    await this.assertSizesFit(user, fileKinds, sizes, packageId);
  }

  private async assertSizesFit(
    user: StorageQuotaUser,
    fileKinds: Map<string, Set<PackageFileType>>,
    sizes: Map<string, number>,
    replacePackageId?: number
  ): Promise<void> {
    if (!user.id) {
      return;
    }

    const { limits } = await this.getLimitsFor(user);

    for (const [filename, kinds] of fileKinds) {
      const size = sizes.get(filename);
      for (const kind of kinds) {
        const limit = limits[`${kind}Bytes`];
        if (size !== undefined && limit !== null && size > limit) {
          throw new ClientError(
            ClientResponse.STORAGE_FILE_TOO_LARGE,
            HttpStatus.PAYLOAD_TOO_LARGE,
            {
              kind,
              size: ByteUtils.format(size),
              limit: ByteUtils.format(limit)
            }
          );
        }
      }
    }

    const packageBytes = [...sizes.values()].reduce((total, size) => total + size, 0);
    if (limits.packageBytes !== null && packageBytes > limits.packageBytes) {
      throw new ClientError(
        ClientResponse.STORAGE_PACKAGE_TOO_LARGE,
        HttpStatus.PAYLOAD_TOO_LARGE,
        {
          size: ByteUtils.format(packageBytes),
          limit: ByteUtils.format(limits.packageBytes)
        }
      );
    }

    if (limits.userQuotaBytes !== null) {
      const otherFiles = await this.storageRepository.getUserFiles(user.id, replacePackageId);
      const totalSizes = new Map(otherFiles.map((file) => [file.filename, file.size ?? 0]));

      for (const [filename, size] of sizes) {
        totalSizes.set(filename, Math.max(size, totalSizes.get(filename) ?? 0));
      }

      const used = [...totalSizes.values()].reduce((total, size) => total + size, 0);
      if (used > limits.userQuotaBytes) {
        throw new ClientError(ClientResponse.STORAGE_QUOTA_EXCEEDED, HttpStatus.PAYLOAD_TOO_LARGE, {
          size: ByteUtils.format(used),
          limit: ByteUtils.format(limits.userQuotaBytes)
        });
      }
    }

    await this.assertBucketHasRoom(user, [...fileKinds.keys()], sizes);
  }

  /**
   * Avatars: the picture is already stored, so its real size is checked. The
   * avatar usage it replaces is left out; the same file still counts if one
   * of the user's packages references it.
   */
  public async assertAvatarFits(
    user: StorageQuotaUser,
    filename: string,
    replacedFilename?: string
  ): Promise<void> {
    const size = await this.verifyFile(filename);
    if (size === null || !user.id) {
      return;
    }

    const { limits } = await this.getLimitsFor(user);
    if (limits.imageBytes !== null && size > limits.imageBytes) {
      throw new ClientError(ClientResponse.STORAGE_FILE_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE, {
        kind: "image",
        size: ByteUtils.format(size),
        limit: ByteUtils.format(limits.imageBytes)
      });
    }

    if (limits.userQuotaBytes !== null) {
      const files = await this.storageRepository.getUserFiles(user.id, undefined, replacedFilename);
      const used =
        files
          .filter((file) => file.filename !== filename)
          .reduce((total, file) => total + (file.size ?? 0), 0) + size;
      if (used > limits.userQuotaBytes) {
        throw new ClientError(ClientResponse.STORAGE_QUOTA_EXCEEDED, HttpStatus.PAYLOAD_TOO_LARGE, {
          size: ByteUtils.format(used),
          limit: ByteUtils.format(limits.userQuotaBytes)
        });
      }
    }
  }

  private async assertBucketHasRoom(
    user: StorageQuotaUser,
    filenames: string[],
    sizes: Map<string, number>
  ): Promise<void> {
    const quota = this.env.S3_BUCKET_QUOTA_BYTES;
    if (!quota || (await this.getLimitsFor(user)).group === StorageGroup.ADMIN) {
      return;
    }

    const storedFilenames = await this.storageRepository.getKnownFilenames(filenames);
    const incoming = filenames
      .filter((filename) => !storedFilenames.has(filename))
      .reduce((total, filename) => total + (sizes.get(filename) ?? 0), 0);
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
    if (head) {
      await this.storageRepository.setVerifiedSize(filename, head.size);
    }

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
    const groups = Object.values(StorageGroup).map((group): StorageGroupLimits => {
      const row = rows.find((limit) => limit.group === group);

      return { group, ...(row ? this.toLimits(row) : NO_LIMITS) };
    });
    const topUsers = await Promise.all(
      top.map(async (user) => {
        const quota = await this.storageRepository.getUserQuota(user.id);
        const group = this.groupOf({
          is_guest: user.isGuest,
          permissions: user.permissions.map((name) => ({ name }))
        });
        const groupQuota = groups.find((limits) => limits.group === group)?.userQuotaBytes ?? null;

        return {
          id: user.id,
          username: user.username,
          usedBytes: user.usedBytes,
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

  public async setGroupLimits(
    group: StorageGroup,
    limits: StorageLimits
  ): Promise<StorageGroupLimits> {
    const row = (await this.storageRepository.getLimit(group)) ?? new StorageLimit();
    row.group = group;
    row.user_quota_bytes = limits.userQuotaBytes;
    row.package_bytes = limits.packageBytes;
    row.image_bytes = limits.imageBytes;
    row.audio_bytes = limits.audioBytes;
    row.video_bytes = limits.videoBytes;
    const saved = await this.storageRepository.saveLimit(row);
    this.logger.audit("Storage limits changed", { prefix: LogPrefix.ADMIN, group, limits });

    return { group, ...this.toLimits(saved) };
  }

  public async setUserQuota(userId: number, quotaBytes: number | null): Promise<void> {
    await this.storageRepository.setUserQuota(userId, quotaBytes);
    this.logger.audit("User storage quota changed", {
      prefix: LogPrefix.ADMIN,
      userId,
      quotaBytes
    });
  }
  private toLimits(row: StorageLimit): StorageLimits {
    return {
      userQuotaBytes: row.user_quota_bytes,
      packageBytes: row.package_bytes,
      imageBytes: row.image_bytes,
      audioBytes: row.audio_bytes,
      videoBytes: row.video_bytes
    };
  }
}
