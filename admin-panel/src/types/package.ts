// Package-related enums and types (mirrored from server)
export enum AgeRestriction {
  A18 = "A18",
  A16 = "A16",
  A12 = "A12",
  NONE = "NONE",
}

export const ageRestrictionOptions = [
  { value: AgeRestriction.NONE, label: "No restriction" },
  { value: AgeRestriction.A12, label: "12+" },
  { value: AgeRestriction.A16, label: "16+" },
  { value: AgeRestriction.A18, label: "18+" },
];

export enum PackageSortBy {
  ID = "id",
  TITLE = "title",
  CREATED_AT = "created_at",
  AUTHOR = "author",
}

export const packageSortOptions = [
  { value: PackageSortBy.CREATED_AT, label: "Created Date" },
  { value: PackageSortBy.TITLE, label: "Title" },
  { value: PackageSortBy.AUTHOR, label: "Author" },
  { value: PackageSortBy.ID, label: "ID" },
];

// Extended package types for admin panel
export interface ShortUserInfo {
  id: number;
  username: string;
}

export interface PackageFileDTO {
  id?: number;
  md5: string;
  type: string;
  link: string;
}

export interface PackageTagDTO {
  tag: string;
}

export interface AdminPackageDTO {
  id?: number;
  title: string;
  description?: string | null;
  createdAt: Date;
  author: ShortUserInfo;
  ageRestriction: AgeRestriction;
  language?: string | null;
  logo?: { file: PackageFileDTO } | null;
  tags: PackageTagDTO[];
}
