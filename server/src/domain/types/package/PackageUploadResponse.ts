import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";

export interface PackageUploadResponse {
  id: number;
  uploadLinks: Record<string, string>;
  /** `ready` when storage already holds every file, so nothing needs uploading. */
  uploadStatus?: PackageUploadStatus;
}
