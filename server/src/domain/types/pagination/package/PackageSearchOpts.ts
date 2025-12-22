import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PaginationOptsBase } from "domain/types/pagination/PaginationOpts";
import { Package } from "infrastructure/database/models/package/Package";

export interface PackageSearchOpts extends PaginationOptsBase<Package> {
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
