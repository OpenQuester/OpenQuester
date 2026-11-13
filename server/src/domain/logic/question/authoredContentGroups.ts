import type { QuestionTextItemDTO } from "domain/types/dto/package/PackageQuestionDTO";
import type { PackageFileType } from "domain/enums/package/PackageFileType";

interface AuthoredContentSource<T> {
  files?: readonly T[] | null;
  text?: string | null;
  textOrder?: number | null;
  textItems?: readonly QuestionTextItemDTO[] | null;
  textDurationMs?: number | null;
  textWaitForFinish?: boolean | null;
}

/** Text always closes a group. Only media can opt out of waiting. */
export function authoredContentGroups<
  T extends { order: number; waitForFinish?: boolean; file: { type: PackageFileType } }
>(source: AuthoredContentSource<T>): (QuestionTextItemDTO | { order: number; media: T })[][] {
  const texts = [
    ...(source.textOrder != null && (source.text?.trim() || source.textDurationMs != null)
      ? [
          {
            order: source.textOrder,
            text: source.text ?? "",
            durationMs: source.textDurationMs
          }
        ]
      : []),
    ...(source.textItems ?? [])
      .filter((item) => item.text.trim() || item.durationMs != null || item.placement === "replic")
      .map((item) => ({ ...item }))
  ];
  // Stable sorting keeps text first on a legacy order tie.
  const entries = [
    ...texts,
    ...(source.files ?? []).map((media) => ({ order: media.order, media }))
  ].sort((a, b) => a.order - b.order);
  const groups: (typeof entries)[] = [];
  let group: typeof entries = [];
  for (const entry of entries) {
    group.push(entry);
    if (!("media" in entry) || entry.media.waitForFinish !== false) {
      groups.push(group);
      group = [];
    }
  }
  if (group.length) {
    groups.push(group);
  }
  return groups;
}
