import type { QuestionTextItem } from "@/features/upload/types";
import type { QuestionFile } from "./protocol";

export const VISUAL_QUEUE_THRESHOLD = 5;

export interface AuthoredContentSource<T> {
  files?: readonly T[] | null;
  text?: string | null;
  textOrder?: number | null;
  textItems?: readonly QuestionTextItem[] | null;
  textDurationMs?: number | null;
  textWaitForFinish?: boolean | null;
}

export function isVisual({ file }: Pick<QuestionFile, "file">) {
  return file.type === "image" || file.type === "video";
}

/** Text always closes a group. Only media can opt out of waiting. */
export function authoredContentGroups<T extends Pick<QuestionFile, "order" | "waitForFinish">>(
  source: AuthoredContentSource<T>,
) {
  const texts = [
    ...(source.textOrder != null && (source.text?.trim() || source.textDurationMs != null)
      ? [
          {
            order: source.textOrder,
            text: source.text ?? "",
            durationMs: source.textDurationMs,
          },
        ]
      : []),
    ...(source.textItems ?? [])
      .filter((item) => item.text.trim() || item.durationMs != null || item.placement === "replic")
      .map((item) => ({ ...item })),
  ];
  const entries = [
    ...texts,
    ...(source.files ?? []).map((media) => ({ order: media.order, media })),
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
  if (group.length) groups.push(group);
  return groups;
}
