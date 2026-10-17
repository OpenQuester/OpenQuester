import { type ShortUserInfo } from "domain/types/user/ShortUserInfo";

/** Package fields a running game keeps with its own copy of the package. */
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
