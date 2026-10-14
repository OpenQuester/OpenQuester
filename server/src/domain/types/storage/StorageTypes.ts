/** Who a limit applies to. Derived from the user, never stored on them. */
export enum StorageGroup {
  GUEST = "guest",
  USER = "user",
  MODERATOR = "moderator",
  ADMIN = "admin"
}

/** Bytes; null means no limit. */
export interface StorageLimits {
  userQuotaBytes: number | null;
  packageBytes: number | null;
  imageBytes: number | null;
  audioBytes: number | null;
  videoBytes: number | null;
}

export interface StorageGroupLimits extends StorageLimits {
  group: StorageGroup;
}

/** What GET /v1/me/storage answers. */
export interface MyStorageDTO {
  group: StorageGroup;
  usedBytes: number;
  /** The user's own quota when an admin set one, else the group's. */
  quotaBytes: number | null;
  /** True when quotaBytes comes from a per-user override. */
  quotaOverridden: boolean;
  limits: StorageLimits;
}

export interface StorageUserUsageDTO {
  id: number;
  username: string;
  group: StorageGroup;
  usedBytes: number;
  quotaBytes: number | null;
  quotaOverridden: boolean;
}

export interface AdminStorageDTO {
  bucket: {
    /** Distinct stored files the database knows the size of. */
    usedBytes: number;
    fileCount: number;
    /** S3_BUCKET_QUOTA_BYTES, when set. */
    quotaBytes: number | null;
  };
  groups: StorageGroupLimits[];
  topUsers: StorageUserUsageDTO[];
}
