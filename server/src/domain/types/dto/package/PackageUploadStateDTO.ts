import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";

/** Where a package's media upload stands, for its author to resume it. */
export interface PackageUploadStateDTO {
  id: number;
  status: PackageUploadStatus;
  /** Distinct media files the package uses. */
  totalFiles: number;
  /** Of those, how many storage holds. */
  uploadedFiles: number;
  /** MD5s storage doesn't have yet. */
  missing: string[];
  /** A fresh upload link per missing MD5. */
  uploadLinks: Record<string, string>;
}
