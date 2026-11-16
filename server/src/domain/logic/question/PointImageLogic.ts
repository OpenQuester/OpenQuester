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

/** Select the last authored script occurrence only if it is an image. */
export function scriptPointImageOrder(
  files: PackageQuestionFileDTO[] | null | undefined,
  texts: { order: number }[] | null | undefined
): number {
  const order = Math.max(
    -1,
    ...(files ?? []).map((item) => item.order),
    ...(texts ?? []).map((item) => item.order)
  );
  return !texts?.some((item) => item.order === order) && findPointAnswerImage(files, order)
    ? order
    : -1;
}
