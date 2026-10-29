import { PackageFileType } from "domain/enums/package/PackageFileType";
import type { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";

/** Resolve an explicit image order, or the first image for a legacy question. */
export function pointImage(
  files: PackageQuestionFileDTO[] | null | undefined,
  order: number | null | undefined
): PackageQuestionFileDTO | undefined {
  if (order != null) {
    const matches = (files ?? []).filter((file) => file.order === order);
    return matches.length === 1 && matches[0].file.type === PackageFileType.IMAGE
      ? matches[0]
      : undefined;
  }
  return [...(files ?? [])]
    .sort((a, b) => a.order - b.order)
    .find((file) => file.file.type === PackageFileType.IMAGE);
}
