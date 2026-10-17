/** Who a limit applies to. Derived from the user, never stored on them. */
export enum StorageGroup {
  GUEST = "guest",
  USER = "user",
  MODERATOR = "moderator",
  ADMIN = "admin"
}

/**
 * Size in bytes of each media file of an upload, keyed by the file's MD5 (with
 * or without extension), as the uploading client measured it. Validated by
 * `uploadPackageScheme` and checked against the storage limits.
 */
export interface ClientFileSizes {
  [filename: string]: number;
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

export interface StoragePermission {
  name: string;
}

export interface StorageUserFacts {
  is_guest: boolean;
  permissions: StoragePermission[];
}

/** One row per content-addressed filename, regardless of duplicate database rows. */
export interface StoredFileSize {
  filename: string;
  size: number | null;
}

/** Database usage projection used before storage groups and overrides are applied. */
export interface StorageUserUsageRecord {
  id: number;
  username: string;
  usedBytes: number;
  isGuest: boolean;
  permissions: string[];
}

/** Minimal entity projection accepted by quota checks, before relations are loaded. */
export interface StorageQuotaUser {
  id?: number;
  is_guest?: boolean;
  permissions?: StoragePermission[];
}

/** The group limits after applying a user's personal quota override. */
export interface EffectiveStorageLimits {
  group: StorageGroup;
  limits: StorageLimits;
  overridden: boolean;
}

export interface StorageBucketUsage {
  /** Each content-addressed file contributes its bytes only once. */
  usedBytes: number;
  fileCount: number;
}

export interface StorageBucketDTO extends StorageBucketUsage {
  /** S3_BUCKET_QUOTA_BYTES, when set. */
  quotaBytes: number | null;
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
  bucket: StorageBucketDTO;
  groups: StorageGroupLimits[];
  topUsers: StorageUserUsageDTO[];
}
