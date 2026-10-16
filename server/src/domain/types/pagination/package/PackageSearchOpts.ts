import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PaginationOptsBase } from "domain/types/pagination/PaginationOpts";

export type PackageSortField = "id" | "title" | "created_at" | "author";

export interface PackageSearchOpts
  extends PaginationOptsBase<PackageSortField> {
  // Text search
  title?: string;
  description?: string;

  // Filters
  language?: string;
  authorId?: number;
  tags?: string[]; // Tag names
  ageRestriction?: AgeRestriction;
  /** Content fingerprint sent on upload; finds the same package uploaded before. */
  sourceHash?: string;
  /** `ready` keeps only packages whose media is all in storage. */
  uploadStatus?: PackageUploadStatus;

  // Stats filters (ranges)
  minRounds?: number;
  maxRounds?: number;
  minQuestions?: number;
  maxQuestions?: number;
}
