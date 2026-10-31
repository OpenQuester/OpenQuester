import { PackageFileType } from "domain/enums/package/PackageFileType";
import type { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";

/** Resolve an explicit image order, or the first image for a legacy question. */
export function findPointAnswerImage(
  files: PackageQuestionFileDTO[] | null | undefined,
  order: number | null | undefined
): PackageQuestionFileDTO | undefined {
  // Explicit target: the order must identify exactly one image.
  if (order != null) {
    const matches = (files ?? []).filter((file) => file.order === order);
    return matches.length === 1 && matches[0].file.type === PackageFileType.IMAGE
      ? matches[0]
      : undefined;
  }
  // Legacy questions use their earliest image when no target order was stored.
  return [...(files ?? [])]
    .sort((a, b) => a.order - b.order)
    .find((file) => file.file.type === PackageFileType.IMAGE);
}
