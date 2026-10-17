import { type ShortUserInfo } from "domain/types/user/ShortUserInfo";

/** Immutable metadata stored separately from a game's mutable package data. */
export interface PackageMetaDTO {
  id?: number;
  title: string;
  description?: string | null;
  author: ShortUserInfo;
  ageRestriction: string;
  language?: string | null;
  logo?: { file: unknown } | null;
  tags: { tag: string }[];
  createdAt: string;
}
