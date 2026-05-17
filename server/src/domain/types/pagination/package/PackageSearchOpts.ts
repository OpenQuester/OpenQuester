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

  // Stats filters (ranges)
  minRounds?: number;
  maxRounds?: number;
  minQuestions?: number;
  maxQuestions?: number;
}
